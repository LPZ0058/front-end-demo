/**
 * 返回一个会被节流调用fn的函数
 * @param {*} fn 要调用的函数 
 * @param {*} wait 
 * @returns 
 */
function throttle(fn, wait) {
  let lastTime = 0;
  let timer;
  let run;
  return function (...args) {
    /**
     * 每次调用这个函数会立即进行调用然后再利用serTimout进行调度，wait毫秒后再调用一次.如果当前调用的时候和上从调用的时间
     * 间隔不足wait那么就不会被调用
     * 这里为什么要调用后还要再用setTimout进行一次调度呢？
     * 是为了更近顺滑，按上面的逻辑，如果第一次调度后 wait时间内用户直接把进度条拉到最下，那么此时触发的调度会被无效化，此时因为
     * 已经是进度条的最下面了，不会再通过scroll事件进行触发了，但此时，应该接着加载才对的
     */
    if(!run) {
      run = function () {
        const now = new Date().valueOf();
        if (now - lastTime > wait) {
          fn.apply(this, args);
          lastTime = now;
        }
      }
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(run, wait);
    run();
  }
}

// 封装虚拟滚动的类
/**
 * 1. element 虚拟列的容器
 * 2. 容器的高度
 * 3. 每项的高度
 * 4. 每页的数据条数,其实就是每次加载的最小元
 * 5. 
 */
class VirtualScroller {
  constructor({
    element,
    height,
    rowHeight,
    pageSize,
    buffer,
    renderItem,
    loadMore // 加载下number条数据
  }) {
    /**
     * 内部是属性:
     *  scroller -> 指向虚拟列表的容器，可以是任意一个div
     */
    if (typeof element === 'string') {
      this.scroller = document.querySelector(element);
    } else if (element instanceof HTMLElement) {
      this.scroller = element;
    }

    if (!this.scroller) {
      throw new Error('Invalid element');
    }

    if (!height || (typeof height !== 'number' && typeof height !== 'string')) {
      throw new Error('invalid height value');
    }

    if (!rowHeight || typeof rowHeight !== 'number') {
      throw new Error('rowHeight should be a number');
    }

    if (typeof renderItem !== 'function') {
      throw new Error('renderItem is not a function');
    }

    if (typeof loadMore !== 'function') {
      throw new Error('renderItem is not a function');
    }

    // set props
    this.height = height;
    this.rowHeight = rowHeight;
    // 每页的条数
    this.pageSize = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 50;
    // 虚拟列表上下缓存的内容条数
    this.buffer = typeof buffer === 'number' && buffer >= 0 ? buffer : 10;
    // 渲染列表中的一项的方法,既将item转成一项真实DOM的方法，内部会直接把他插入列表中
    this.renderItem = renderItem;
    // 加载下number条数据
    this.loadMore = loadMore;
    // 加载的数据
    this.data = [];

    // create content box
    /**
     * 1.为scroller添加子元素，它的内容就是长列表，高度也由长列表撑起来
     * 2.设置scroller的高度
     * 3.pageSize每次加载数据的最小单元
     * 4.this.#scrollTop上次的scrollTop，作用是用来判断当前scroll的方向
     */
    const contentBox = document.createElement('div');
    this.contentBox = contentBox;
    this.scroller.append(contentBox);

    this.scroller.style.height = typeof height === 'number' ? height + 'px' : height;

    this.#loadInitData();
    // 监听scroll事件
    this.scroller.addEventListener('scroll', throttle(this.#handleScroll, 150));
  }

  #topHiddenCount = 0;
  #bottomHiddenCount = 0;
  #scrollTop = 0;
  #paddingTop = 0;
  #paddingBottom = 0;
  #lastVisibleItemIndex = 0;

  // 初始首次数据
  #loadInitData() {
    // getBoundingClientRect方法返回一个DOMRect对象，提供了当前元素大小和相对于视口的位置
    const scrollerRect = this.scroller.getBoundingClientRect();
    // 求视口最多能完整显示的列表数
    const minCount = Math.ceil(scrollerRect.height / this.rowHeight);
    // 首屏能显示的页数
    const page = Math.ceil(minCount / this.pageSize);
    // 加载page * this.pageSize条数据（首屏的数据）
    const newData = this.loadMore(page * this.pageSize);
    // 塞入数据
    this.data.push(...newData);
    // 渲染数据
    this.#renderNewData(newData);
    // console.log(`page=${page} ; pageSize=${this.pageSize} ; minCount=${minCount}`)
  }

  #renderRow(item) {
    const rowContent = this.renderItem(item);
    const row = document.createElement('div');
    row.dataset.index = item
    row.style.height = this.rowHeight + 'px';
    row.appendChild(rowContent)
    return row;
  }

  #renderNewData(newData) {
    newData.forEach(item => {
      this.contentBox.append(this.#renderRow(item));
    });
  }

  // 每次滚动会节流调用改函数
  #handleScroll = (e) => {
    /**
     * clientHeight 的值使用滚动条的时候元素的高度，其实就相当于容器的高度
     * scrollHeight 的值等于该元素在不使用滚动条的情况下为了适应视口中所用内容所需的最小高度
     * scrollTop 的值是当前显示的内容的上边界到全部内容的上边界的值，既：一个元素的 scrollTop 值是这个元素的内容顶部
     *             （卷起来的）到它的视口可见内容（的顶部）的距离的度量
     */
    const { clientHeight, scrollHeight, scrollTop } = e.target;
    // 当前显示内容的下边界，离已经加载的内容(但是被隐藏了)不足40的时候，进行加载
    if (scrollHeight - (clientHeight + scrollTop) < 40) {
      console.log('load more');
      // 再次加载下一个单元pageSize
      const newData = this.loadMore(this.pageSize);
      this.data.push(...newData);
    }
    // 获取滚动的方向
    // 这才是虚拟列表，上面的算是按需加载，按需加载内容到data中，但是页面上渲染的内容(DOM节点)的内容没有那么多
    // 但还是比视口显示的要多，上下都多若干条这样
    // 利用了padding-top和padding-bottom撑起了高度，因此对于scroller来说，和真正有那些元素是一样的，因此上面的逻辑
    // 既按需加载的逻辑是行的通的
    const direction = scrollTop > this.#scrollTop ? 1 : -1;
    this.#toggleTopItems(direction);
    this.#toggleBottomItems(direction);
    // console.log(`this.data=${this.data}`)
    this.#scrollTop = scrollTop;
    console.log({
      direction,
      topHiddenCount: this.#topHiddenCount,
      lastVisibleItemIndex: this.#lastVisibleItemIndex
    });
    // console.log(`clientHeight=${clientHeight} ; scrollHeight=${scrollHeight} ; scrollTop=${scrollTop}`)
  }

  /**
   * #toggleTopItem和#toggleBottomItems的工作：
   * 1.主要是维护了需要渲染的DOM元素数组
   * 2.而视口显示的内容主要是通过维护padding-top和padding-buttom去实现的
   * @param {*} direction 
   */
  #toggleTopItems = (direction) => {
    const { scrollTop } = this.scroller;
    // 当前视口第一个渲染的内容的下标
    const firstVisibleItemIndex = Math.floor(scrollTop / this.rowHeight);
    // 当处于DOM树的第一个渲染内容的下标
    const firstExistingItemIndex = Math.max(0, firstVisibleItemIndex - this.buffer);
    // 获取Dom中渲染队列表，这个是个动态的
    const rows = this.contentBox.children;
    // replace invisible top items with padding top
    // 如果鼠标向下滚动
    if (direction === 1) {
      // this.#topHiddenCount是data中top方向上被隐藏的元素的总数
      // 清除DOM中因为滚轮下滑，而应该被清除的DOM元素（维护）
      for (let i = this.#topHiddenCount; i < firstExistingItemIndex; i++) {
        // rows就是在DOM中渲染的元素
        if (rows[0]) rows[0].remove();
      }
    }
    // 如果鼠标向上滚动
    // restore hidden top items
    if (direction === -1) {
      for (let i = this.#topHiddenCount - 1; i >= firstExistingItemIndex; i--) {
        const item = this.data[i];
        const row = this.#renderRow(item);
        this.contentBox.prepend(row);
      }
    }
    this.#topHiddenCount = firstExistingItemIndex;
    // 更新paddingTop，模拟内容
    this.#paddingTop = this.#topHiddenCount * this.rowHeight;
    this.contentBox.style.paddingTop = this.#paddingTop + 'px';
    // console.log(`rows=${rows}`,rows)
  }

  #toggleBottomItems = (direction) => {
    const { scrollTop, clientHeight } = this.scroller;
    // 当前视口最后一个渲染函数的下标
    const lastVisibleItemIndex = Math.floor((scrollTop + clientHeight) / this.rowHeight);
    // 当前渲染树的最后一个内容的下标
    const lastExistingItemIndex = lastVisibleItemIndex + this.buffer;

    this.#lastVisibleItemIndex = lastVisibleItemIndex;
    const rows = [...this.contentBox.children];
    // replace invisible bottom items with padding bottom
    // 鼠标向上滚动，那么下面的元素就应该被移除
    if (direction === -1) {

      for (let i = lastExistingItemIndex + 1; i <= this.data.length; i++) {
        // i - this.#topHiddenCount 是 data[i]在rows下面的元素的下标
        const row = rows[i - this.#topHiddenCount];
        if (row) row.remove();
      }
    }
    // restore hidden bottom items
    // 鼠标向下滚动，那么下面的元素应该增加
    if (direction === 1) {
      // this.#topHiddenCount + rows.length 就是原本的lastExistingItemIndex的下标（易想，因为this.#topHiddenCount变小了）
      for (let i = this.#topHiddenCount + rows.length; i <= lastExistingItemIndex; i++) {
        const item = this.data[i];
        if (!item) break;
        const row = this.#renderRow(item);
        this.contentBox.append(row);
      }
    }
    // 计算下面不在DOM树的元素的数量
    this.#bottomHiddenCount = Math.max(0, this.data.length - (this.#topHiddenCount + this.contentBox.children.length) - this.buffer);
    this.#paddingBottom = this.#bottomHiddenCount * this.rowHeight;
    this.contentBox.style.paddingBottom = this.#paddingBottom + 'px';
  }
}