;
(function (doc, win) {
  var oImgList = doc.getElementsByClassName('J_imgList')[0],
    data = JSON.parse(doc.getElementById('J_data').innerHTML),
    imgTpl = doc.getElementById('J_imgTpl').innerHTML,
    // 返回的是HTMLCollection，这是一个动态的类数组，因此后面拼接的时候会更新
    oImgs = doc.getElementsByClassName('list-img');

  var init = function () {
    // 对数据进行渲染，只是每个图片是加载的默认图片
    renderList(data);
    bindEvent();
  }

  function bindEvent() {
    // win.onload触发是是首屏加载
    win.onscroll = win.onload = throttle(
      imgLazyLoad(oImgs), 800);
  }

  function imgLazyLoad(images) {
    var len = images.length,
      cHeight = document.documentElement.clientHeight,
      // 将n提出（闭包），这样以后触发
      n = 0;

    return function () {
      var sTop = document.documentElement.scrollTop || document.body.scrollTop,
        imgItem;

      for (var i = n; i < len; i++) {
        imgItem = images[i];
        /**
         * offsetTop：元素到offsetParent顶部的距离，而offsetParent：距离元素最近的一个具有定位的祖宗元素
         * （relative，absolute，fixed），若祖宗都不符合条件，offsetParent为body，案例中就是body
         * 
         * imgItem.offsetTop < cHeight + sTop 表示图片进入过视野中（被滑过）
         */
        if (imgItem.offsetTop < cHeight + sTop) {
          // 将src的值替换为data-src的值，这个才是真正的地址
          imgItem.src = imgItem.getAttribute('data-src');
          imgItem.removeAttribute('data-src');
          n++;
        }
      }
    }

  }


  function renderList(data) {
    // var list = '';
    // // 要将模板中双括弧用正则进行匹配，然后替换里面的内容，然后进行拼接
    // data.forEach(function (item) {
    //   // replace的第二个参数传为一个函数，MDN上有详细描述，这里要替换的是data-src这个属性存储了改图片的真正地址，以及alt
    //   list += imgTpl.replace(/{{(.*?)}}/g, function (node, key) {
    //     return {
    //       img: item.img,
    //       name: item.name
    //     } [key]
    //   })
    // });

    // oImgList.innerHTML = list;

    oImgList.innerHTML = data.reduce((pre, item) => {
      return pre + imgTpl.replace(/{{(.*?)}}/g, function (node, key) {
        return {
          img: item.img,
          name: item.name
        } [key]
      })
    }, '');
  }

  init();



})(document, window);

function throttle(fn, delay) {
  // 计时器的ID
  var t = null,
    // 函数执行的结果
    res,
    // 上次执行的时间
    begin = 0;

  return function () {
    var args = arguments,
      _self = this,
      cur = new Date().getTime();

    if (t) {
      clearTimeout(t);
    }

    if (cur - begin >= delay) {
      res = fn.apply(_self, args);
      begin = cur;
    } else {
      // 时间没到则delay后再执行
      t = setTimeout(function () {
        res = fn.apply(_self, args);
      }, delay);
    }
    return res;
  };
}