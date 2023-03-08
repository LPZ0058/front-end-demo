<template>
  <div id="app">
    <!-- 仍然是选择自己上传，这里利用on-change事件获取放入的文件 -->
    <el-upload drag action 
    :auto-upload="false" 
    :show-file-list="false" 
    :on-change="changeFile">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        将文件拖到此处，或
        <em>点击上传</em>
      </div>
    </el-upload>

    <!-- PROGRESS -->
    <div class="progress">
      <span>上传进度：{{total|totalText}}%</span>
      <el-link type="primary" v-if="total>0 && total<100" @click="handleBtn">{{btn|btnText}}</el-link>
    </div>

    <!-- VIDEO -->
    <div class="uploadImg" v-if="video">
      <video :src="video" controls />
    </div>
  </div>
</template>

<script>
import { fileParse } from "./assets/utils";
import axios from "axios";
import SparkMD5 from "spark-md5";

export default {
  name: "App",
  data() {
    return {
      // 上传的百分比？
      total: 0,
      video: null,
      // false表示暂停，true表示继续
      btn: false,
    };
  },
  filters: {
    btnText(btn) {
      return btn ? "继续" : "暂停";
    },
    totalText(total) {
      return total > 100 ? 100 : total;
    },
  },
  methods: {
    async changeFile(file) {
      if (!file) return;
      file = file.raw;

      // 解析为BUFFER数据
      // 我们会把文件切片处理：把一个文件分割成为好几个部分（固定数量/固定大小）
      // 每一个切片有自己的部分数据和自己的名字
      // HASH_1.mp4
      // HASH_2.mp4
      // ...
      // 这里面的buff只是为了根据内容获取hash
      let buffer = await fileParse(file, "buffer"),
        spark = new SparkMD5.ArrayBuffer(),
        hash,
        suffix;
      spark.append(buffer);
      hash = spark.end();
      suffix = /\.([0-9a-zA-Z]+)$/i.exec(file.name)[1];

      // 创建100个切片
      let partList = [],
      // 每个切片的大小,因为可能会有除不尽的情况，因此要向上取整
        partsize = Math.ceil(file.size / 100),
        // 当前切片的起点
        cur = 0;
      for (let i = 0; i < 100; i++) {
        let item = {
          chunk: file.slice(cur, cur + partsize),
          // 文件名的规则：根据文件内容生成hash_切片.后缀名
          filename: `${hash}_${i}.${suffix}`,
        };
        cur += partsize;
        partList.push(item);
      }
      // 这里partList和hash没有在data声明，因为不需要搞成响应式的呀
      this.partList = partList;
      this.hash = hash;
      this.sendRequest();
    },
    async sendRequest() {
      // 根据100个切片创造100个请求（集合）
      let requestList = [];
      this.partList.forEach((item, index) => {
        // 每一个函数都是发送一个切片的请求
        let fn = () => {
          let formData = new FormData();
          // 这里直接把对应的blob发送出去就成了
          formData.append("chunk", item.chunk);
          formData.append("filename", item.filename);
          return axios
            .post("/single3", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            })
            .then((result) => {
              result = result.data;
              if (result.code == 0) {
                // 每发送完一个切片就把total加1
                this.total += 1;
                // 传完的切片我们把它移除掉
                this.partList.splice(index, 1);
              }
            });
        };
        requestList.push(fn);
      });

      // 传递：并行(ajax.abort())/串行(基于标志控制不发送)，这里是串行的逻辑，完全可以
      let i = 0;
      // 这complete函数是发送文件内容的hash去获取对应的文件地址，设置给video进行播放
      // 要在传送完后使用
      let complete = async () => {
        let result = await axios.get("/merge", {
          params: {
            hash: this.hash,
          },
        });
        result = result.data;
        if (result.code == 0) {
          this.video = result.path;
        }
      };
      // 这个函数就是一个个上传切片，每次传之前检测下this.abort，如果为true则暂停传送
      // 如果传完了i=100则调用compelete
      let send = async () => {
        // 已经中断则不再上传
        if (this.abort) return;
        if (i >= requestList.length) {
          // 都传完了
          complete();
          return;
        }
        // 等待切片上传完，// TODO 但是这里好像有点问题，因为如果切片上传失败的处理没有给出，上传失败应该再次尝试上传
        await requestList[i]();
        
        i++;
        send();
      };
      send();
      // TODO 其实这里有优化的逻辑，这里是一个个切片上传，完全可以异步上传，比如同时上传若干个切片
    },
    // TODO 看看这种开关的代码的写法，和我之前写的不一样，学习下
    handleBtn() {
      if (this.btn) {
        //断点续传
        this.abort = false;
        this.btn = false;
        this.sendRequest();
        return;
      }
      //暂停上传
      this.btn = true;
      this.abort = true;
    },

  },
};
</script>