const virtualScroller = new VirtualScroller({
  element: '#virtual-scroller',
  height: '80vh',
  rowHeight: 60, // px
  pageSize: 100, // 每次加载100个数据
  buffer: 10,
  renderItem: function (dataItem) { // 渲染每个数据成节点的方法
    const div = document.createElement('div');
    div.classList.add('row-content');
    div.textContent = dataItem;
    return div;
  },
  loadMore: function (pageSize) { // 提供加载下pageSize个数据的方法
    const data = [];
    for (let i = 0; i < pageSize; i++) {
      const dataItem = `I'm number ${this.data.length + i}`;
      data.push(dataItem);
    }
    return data;
  }
});