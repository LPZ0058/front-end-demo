/*-CREATE SERVER-*/
const express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    SparkMD5 = require('spark-md5'),
    PORT = 8888;
app.listen(PORT, () => {
    console.log(`THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT：${PORT}`);
});
app.use(bodyParser.urlencoded({
    extended: false,
    limit: '1024mb'
}));

/*-API-*/
// TODO 用multiparty去解析multipart/form-data的请求数据
// multiparty的文档：https://www.npmjs.com/package/multiparty
const multiparty = require("multiparty"),
    uploadDir = `${__dirname}/upload`;

function handleMultiparty(req, res, temp) {
    return new Promise((resolve, reject) => {
        // multiparty的配置
        let options = {
            maxFieldsSize: 200 * 1024 * 1024
        };
        // 设置下载的目录地址，这里temp应该是指是否为临时文件，不是则给option设置下载地址，然后这个包就会
        // 在解析的时候将文件进行下载，并且返回对应的file。有个弊端：不能识别这个文件之前是否以及传过了，因此可以改进下，下面那个通过sparkMD5就可以实现
        !temp ? options.uploadDir = uploadDir : null;
        let form = new multiparty.Form(options);
        // multiparty解析请求，parse是异步操作(需要回调函数)，因此用promise去封装，学习下如何封装
        
        form.parse(req, function (err, fields, files) {
            console.log("🚀 ~ file: server.js:31 ~ files:", files)
            console.log("🚀 ~ file: server.js:31 ~ fields:", fields)
            console.log("🚀 ~ file: server.js:31 ~ err:", err)
            
            if (err) {
                res.send({
                    code: 1,
                    reason: err
                });
                reject(err);
                return;
            }
            resolve({
                fields,
                files
            });
        });
    });
}

// 基于FORM-DATA上传数据
app.post('/single1', async (req, res) => {
    let {
        files
    } = await handleMultiparty(req, res);
    let file = files.file[0];
    res.send({
        code: 0,
        originalFilename: file.originalFilename,
        path: file.path.replace(__dirname, `http://127.0.0.1:${PORT}`)
    });
});

// 上传BASE64
app.post('/single2', (req, res) => {
    let {
        chunk,
        filename
    } = req.body;

    // chunk的处理：转换为buffer
    // chunk就是之前用readAsDataURL读出来的东西
    chunk = decodeURIComponent(chunk);
    // 去掉前缀，得到文件的base64
    chunk = chunk.replace(/^data:image\/\w+;base64,/, "");
    // 把base64变成Buffer
    chunk = Buffer.from(chunk, 'base64');

    // 存储文件到服务器
    // 这里利用SparkMD5根据文件内容生成对应的hash值
    let spark = new SparkMD5.ArrayBuffer(),
        // 获取文件后缀名
        suffix = /\.([0-9a-zA-Z]+)$/.exec(filename)[1],
        path;
    // 给spark传入Buffer，然后可以通过spark.end()获取对应hash值，这样可以实现同样的文件只保存一次
    spark.append(chunk);
    // 指定生成文件保存路径
    path = `${uploadDir}/${spark.end()}.${suffix}`;
    // 直接将Buffer写入，这样以及实现了内容相同的文件只存一份，因为生成的文件名相同，这里是覆盖
    // 但更好的是查找这个文件是否存在，如果存在直接返回了
    fs.writeFileSync(path, chunk);
    res.send({
        code: 0,
        originalFilename: filename,
        path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
    });
});

// 切片上传 && 合并
app.post('/single3', async (req, res) => {
    let {
        fields,
        files
    } = await handleMultiparty(req, res, true);
    // 下面的这个chunk是个对象，handleMultiparty解析的时候会缓存，缓存到chunk.path里面
    // 如果指定路径，就会缓存到指定路径，否则就是chunk.path？？是这样么
    /**
        {
            "chunk":[
                {
                    "fieldName":"chunk",
                    "originalFilename":"blob",
                    "path":"E:\\mysystem\\Temp\\WEdNDklKsE5e5-lIA3RC_Nkt",
                    "headers":[
                        null],
                    "size":108302
                }]
        }
     */
    let [chunk] = files.chunk,
        [filename] = fields.filename;
        // console.log("🚀 ~ file: server.js:111 ~ app.post ~ chunk:", chunk)
    // 获取切片对应的文件的hash
    let hash = /([0-9a-zA-Z]+)_\d+/.exec(filename)[1],
        // suffix = /\.([0-9a-zA-Z]+)$/.exec(file.name)[1],
        path = `${uploadDir}/${hash}`;
    // 这里为(每个内容相同的)文件创建一个目录，用于存放切片
    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    path = `${path}/${filename}`;
    // 检测path的文件是否已经存在，既当前切片文件是否存在
    // TODO 了解下这个fs.access,其作用是：测试用户对 path 指定的文件或目录的权限
    fs.access(path, async err => {
        // 存在的则不再进行任何的处理，之前返回成功
        // TODO 其实这里逻辑还缺一个，就是要检测最后合并成的文件是否存在，如果存在了，直接返回
        // 按逻辑，合成最后的文件后会删除切片文件，按理有了最后的文件，在上传切片文件就应该直接返回
        // 而这里还是会创建
        if (!err) {
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
            return;
        }

        // 为了测试出效果，延迟1秒钟
        await new Promise(resolve => {
            setTimeout(_ => {
                resolve();
            }, 200);
        });

        // 不存在的再创建
        let readStream = fs.createReadStream(chunk.path),
            writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on('end', function () {
            // 删除Multiparty在解析时缓存的内容
            fs.unlinkSync(chunk.path);
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
        });
    });
});

app.get('/merge', (req, res) => {
    let {
        hash
    } = req.query;

    let path = `${uploadDir}/${hash}`,
    // fs.readdirSync()方法用于同步读取给定目录的内容。
    // 该方法返回一个数组，其中包含目录中的所有文件名或对象
        fileList = fs.readdirSync(path),
        suffix;
    // 先给fileList按切片的顺序进行排序(// TODO其实可以加个校验的步骤，万一中间有文件没有创建呢？)
    fileList.sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
    }).forEach(item => {
        /**
         * 排完序后，按顺序变量每个文件，依次将他们合并到${uploadDir}/${hash}这个文件中，合并完成后直接删除该文件切片的文件，最后在删除目录
         */
        !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
        fs.appendFileSync(`${uploadDir}/${hash}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        // 删除切片文件
        fs.unlinkSync(`${path}/${item}`);
    });
    // 删除存放切片的目录
    fs.rmdirSync(path);
    res.send({
        code: 0,
        path: `http://127.0.0.1:${PORT}/upload/${hash}.${suffix}`
    });
});
// 设置静态文件目录
app.use(express.static('./'));
app.use((req, res) => {
    res.status(404);
    res.send('NOT FOUND!');
});