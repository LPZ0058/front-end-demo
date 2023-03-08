<template>
  <div id="app">
    <!-- 设置:auto-upload="false"取消自动上传，利用on-change自己上传 -->
    <el-upload drag action 
    :auto-upload="false" 
    :show-file-list="false" :on-change="changeFile">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        将文件拖到此处，或
        <em>点击上传</em>
      </div>
    </el-upload>

    <!-- IMG -->
    <div class="uploadImg" v-show="img">
      <img :src="img" alt />
    </div>
  </div>
</template>

<script>
import { fileParse } from "./assets/utils";
import axios from "axios";
import qs from "qs";

export default {
  name: "App",
  data() {
    return {
      img: null,
    };
  },
  methods: {
    async changeFile(file) {
      if (!file) return;
      // file并不是File只是个封装对象，里面raw属性才是File对象
      file = file.raw;
      // 继续做格式校验
      /*
       * 把上传的文件先进行解析（FileReader）
       * 把其转换base64编码格式
       * 自己基于axios把信息传递给服务器
       * ...
       */
      let result = await fileParse(file, "base64");
      const r = qs.stringify({
          chunk: encodeURIComponent(result),
          filename: file.name,
      });
      console.log("🚀 ~ file: App2.vue:50 ~ changeFile ~ r:", r)
      // qs.stringify可以将普通json对象转成application/x-www-form-urlencoded的格式，好像是 a=b&c=d的格式
      result = await axios.post(
        "/single2",
        qs.stringify({
          chunk: encodeURIComponent(result),
          filename: file.name,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      result = result.data;
      if (result.code == 0) {
        this.img = result.path;
      }
    },
  },
};
</script>