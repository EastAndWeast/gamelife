/**
 * 时光回溯沙盒：Canvas 渲染的蝴蝶效应平行人生分支树
 */

export class TimeBranchTree {
  constructor(canvasId, containerId, onNodeSelected) {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    this.ctx = this.canvas.getContext('2d');
    this.onNodeSelected = onNodeSelected;

    // 树结构数据
    this.nodes = {}; // nodeMap: { id: LifeNode }
    this.rootId = null;
    this.currentNodeId = null;

    // 视图缩放和平移状态
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

    // 布局常量参数
    this.nodeRadius = 14;
    this.levelHeight = 80;    // 每层高度差
    this.siblingWidth = 80;   // 同胞分叉间距

    // 渲染定位缓存 (nodeId -> {x, y})
    this.positions = {};

    // 拖拽控制变量
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // 初始化事件绑定
    this.initEvents();
    this.resizeCanvas();
  }

  // 自适应调整 Canvas 大小
  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  // 初始化树数据并触发重绘
  setData(nodes, rootId, currentNodeId) {
    this.nodes = nodes;
    this.rootId = rootId;
    this.currentNodeId = currentNodeId;
    this.layoutTree();
    this.centerOnCurrentNode();
    this.draw();
  }

  // 计算树结构布局
  layoutTree() {
    if (!this.rootId || !this.nodes[this.rootId]) return;

    this.positions = {};
    
    // 我们先计算每一棵子树的大小，用来分配横向宽度
    const subtreeWidths = {};
    const calculateSubtreeWidth = (nodeId) => {
      const node = this.nodes[nodeId];
      if (!node || !node.children || node.children.length === 0) {
        subtreeWidths[nodeId] = this.siblingWidth;
        return this.siblingWidth;
      }
      let width = 0;
      node.children.forEach(childId => {
        width += calculateSubtreeWidth(childId);
      });
      // 子树的总宽度是所有子节点宽度的累加
      subtreeWidths[nodeId] = Math.max(width, this.siblingWidth);
      return subtreeWidths[nodeId];
    };

    calculateSubtreeWidth(this.rootId);

    // 深度优先遍历，为节点分派绝对 (x, y) 坐标
    const assignPositions = (nodeId, startX, depth) => {
      const node = this.nodes[nodeId];
      if (!node) return;

      const y = depth * this.levelHeight + 50;
      const myWidth = subtreeWidths[nodeId];
      const centerX = startX + myWidth / 2;

      this.positions[nodeId] = { x: centerX, y: y };

      let currentX = startX;
      node.children.forEach(childId => {
        assignPositions(childId, currentX, depth + 1);
        currentX += subtreeWidths[childId];
      });
    };

    // 从 Canvas 中部开始绘制根节点
    assignPositions(this.rootId, 0, 0);

    // 平移使其居中对齐
    if (this.positions[this.rootId]) {
      const rootX = this.positions[this.rootId].x;
      const offsetX = this.canvas.width / 2 - rootX;
      Object.keys(this.positions).forEach(id => {
        this.positions[id].x += offsetX;
      });
    }
  }

  // 视角居中到当前游玩节点
  centerOnCurrentNode() {
    if (!this.currentNodeId || !this.positions[this.currentNodeId]) return;
    const currentPos = this.positions[this.currentNodeId];
    
    this.panX = this.canvas.width / 2 - currentPos.x * this.zoom;
    this.panY = this.canvas.height / 2 - currentPos.y * this.zoom;
  }

  // 交互事件绑定
  initEvents() {
    // 1. 窗口尺寸监听
    window.addEventListener('resize', () => this.resizeCanvas());

    // 2. 鼠标拖拽平移
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.draw();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // 3. 滚轮缩放
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const zoomFactor = 1.1;
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      // 记录缩放前的绝对坐标位置，以便以鼠标为中心缩放
      const beforeZoomX = (mouseX - this.panX) / this.zoom;
      const beforeZoomY = (mouseY - this.panY) / this.zoom;

      if (e.deltaY < 0) {
        this.zoom = Math.min(this.zoom * zoomFactor, 3.0);
      } else {
        this.zoom = Math.max(this.zoom / zoomFactor, 0.4);
      }

      this.panX = mouseX - beforeZoomX * this.zoom;
      this.panY = mouseY - beforeZoomY * this.zoom;

      this.draw();
    }, { passive: false });

    // 4. 节点点击检测
    this.canvas.addEventListener('click', (e) => {
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      // 将屏幕坐标转换为 Canvas 内部绝对绘图坐标
      const clickX = (mouseX - this.panX) / this.zoom;
      const clickY = (mouseY - this.panY) / this.zoom;

      // 寻检点击了哪个节点
      let clickedNodeId = null;
      let minDistance = Infinity;

      Object.keys(this.positions).forEach(nodeId => {
        const pos = this.positions[nodeId];
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        
        if (dist <= this.nodeRadius + 6 && dist < minDistance) {
          minDistance = dist;
          clickedNodeId = nodeId;
        }
      });

      if (clickedNodeId && this.onNodeSelected) {
        this.onNodeSelected(clickedNodeId);
      }
    });
  }

  // 绘制树图
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.rootId || Object.keys(this.nodes).length === 0) return;

    this.ctx.save();
    // 应用平移与缩放矩阵
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. 先绘制连线 (贝塞尔曲线代表时间线)
    this.drawConnections(this.rootId);

    // 2. 后绘制节点本体 (确保盖在连线之上)
    this.drawNodes();

    this.ctx.restore();
  }

  // 绘制树的连线
  drawConnections(nodeId) {
    const node = this.nodes[nodeId];
    if (!node || !this.positions[nodeId]) return;

    const parentPos = this.positions[nodeId];

    node.children.forEach(childId => {
      const childPos = this.positions[childId];
      if (childPos) {
        this.ctx.beginPath();
        this.ctx.moveTo(parentPos.x, parentPos.y);

        // 贝塞尔曲线控制点：沿 Y 轴对称过渡，形成平滑生长的枝丫效果
        const cpY1 = parentPos.y + this.levelHeight * 0.5;
        const cpY2 = childPos.y - this.levelHeight * 0.5;
        this.ctx.bezierCurveTo(parentPos.x, cpY1, childPos.x, cpY2, childPos.x, childPos.y);

        // 连线样式：回忆质感的墨绿粗线
        this.ctx.strokeStyle = '#274c35';
        this.ctx.lineWidth = childId === this.currentNodeId ? 3.5 : 2;
        this.ctx.globalAlpha = childId === this.currentNodeId ? 0.9 : 0.45;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // 递归子节点
        this.drawConnections(childId);
      }
    });
  }

  // 绘制所有节点本体
  drawNodes() {
    Object.keys(this.positions).forEach(nodeId => {
      const pos = this.positions[nodeId];
      const node = this.nodes[nodeId];
      if (!pos || !node) return;

      const isCurrent = nodeId === this.currentNodeId;

      this.ctx.beginPath();
      
      // 1. 绘制外部高光圈或外发光
      if (isCurrent) {
        this.ctx.arc(pos.x, pos.y, this.nodeRadius + 6, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(231, 111, 81, 0.2)'; // 黄昏橘外晕
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, this.nodeRadius + 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#e76f51'; // 橘色发光边框
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
      } else {
        this.ctx.arc(pos.x, pos.y, this.nodeRadius + 3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(39, 76, 53, 0.05)';
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, this.nodeRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#274c35'; // 墨绿普通边框
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      // 2. 节点球填充色
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, this.nodeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = isCurrent ? '#e76f51' : '#f6f3eb'; // 当前节点橘色，其余羊皮纸色
      this.ctx.fill();

      // 3. 绘制节点内部文字 (岁数或序列号)
      this.ctx.fillStyle = isCurrent ? '#f6f3eb' : '#274c35';
      this.ctx.font = `bold 11px ${this.canvas.style.fontFamily || 'Outfit'}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(node.age.toString(), pos.x, pos.y);

      // 4. 在节点旁边绘制其微型标题 (比如 "偷拿钱", "借格小伞")
      if (this.zoom >= 0.7) {
        this.ctx.fillStyle = isCurrent ? '#274c35' : '#5e5950';
        this.ctx.font = isCurrent ? 'bold 11px Noto Serif SC' : '10px Noto Serif SC';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        const textOffsetX = this.nodeRadius + 10;
        const text = node.title.length > 7 ? node.title.substring(0, 6) + '..' : node.title;
        
        // 绘制文字半透明卡片底色以防线段遮挡
        const metrics = this.ctx.measureText(text);
        this.ctx.fillStyle = 'rgba(246, 243, 235, 0.85)';
        this.ctx.fillRect(pos.x + textOffsetX - 2, pos.y - 8, metrics.width + 4, 16);
        
        this.ctx.fillStyle = isCurrent ? '#e76f51' : '#2c2924';
        this.ctx.fillText(text, pos.x + textOffsetX, pos.y);
      }
    });
  }

  // 视角重置
  resetZoom() {
    this.zoom = 1.0;
    this.layoutTree();
    this.centerOnCurrentNode();
    this.draw();
  }

  // 手动缩放 API
  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.2, 3.0);
    this.draw();
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom / 1.2, 0.4);
    this.draw();
  }
}
