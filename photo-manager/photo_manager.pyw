import os
import sys
import json
import shutil
import ctypes
import subprocess
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# --- 自动依赖检测与安装 (Pillow) ---
try:
    from PIL import Image, ImageTk, ImageOps
except ImportError:
    # 弹出提示，静默安装 Pillow
    root = tk.Tk()
    root.withdraw()
    messagebox.showinfo("初始化", "程序正在为您自动安装高性能图像解析库 (Pillow)，这需要几秒钟，请稍候...")
    root.destroy()
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageTk, ImageOps
    except Exception as e:
        # 如果 pip 安装失败，尝试使用用户级安装
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "Pillow"])
            from PIL import Image, ImageTk, ImageOps
        except Exception as err:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("安装失败", f"无法自动安装依赖库 Pillow，请手动运行 'pip install Pillow' 后再启动此程序。\n错误信息: {err}")
            sys.exit(1)

from PIL.ExifTags import TAGS, GPSTAGS

# --- Windows 高 DPI 锐化初始化 (DPI-Aware) ---
try:
    # 告诉 Windows 该进程自身支持高 DPI，防止系统强行拉伸导致界面和文字模糊
    ctypes.windll.shcore.SetProcessDpiAwareness(1) # PROCESS_SYSTEM_DPI_AWARE
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass # 非 Windows 系统或旧系统静默跳过

# --- 现代深色高质感调色板 ---
BG_MAIN = "#121214"         # 极暗背景
BG_CARD = "#1c1c1f"         # 卡片背景
BG_HOVER = "#2a2a2f"        # 悬浮背景
TEXT_MAIN = "#e4e4e7"       # 主文字（白）
TEXT_MUTED = "#a1a1aa"      # 次要文字（灰）
ACCENT_BLUE = "#3b82f6"     # 选中蓝色高亮
ACCENT_RED = "#ef4444"      # 删除红色高亮
BORDER_COLOR = "#2d2d30"    # 边框色
ACCENT_GREEN = "#10b981"    # 按钮绿色高亮

CONFIG_FILE_NAME = ".photo_manager_config.json"

class PhotoManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("📸 高性能照片批量管理器 (High-DPI 锐利版)")
        self.root.geometry("1100x800")
        self.root.configure(bg=BG_MAIN)
        self.root.minsize(800, 600)
        
        # 字体配置 (Segoe UI + 微软雅黑)
        self.font_title = ("Microsoft YaHei", 14, "bold")
        self.font_bold = ("Microsoft YaHei", 9, "bold")
        self.font_normal = ("Microsoft YaHei", 9)
        self.font_small = ("Microsoft YaHei", 8)
        
        # 核心状态变量
        self.image_folder = ""
        self.trash_folder = ""
        self.image_items = []
        self.current_page = 0
        self.selected_indices = set()       # 当前选中的照片在全局列表中的索引
        self.drag_start_index = None        # 左键划选的起点
        self.drag_selected_indices = set()  # 左键划选中记录 of the collection
        self.right_click_timer = None       # 右键单双击区分定时器
        self.loading_token = 0              # 异步加载校验令牌
        self.sort_mode = "name"             # "name" 或 "date"
        self.sort_descending = False        # 默认正序 (最早在最前)
        
        # 预设的网格缩放级别 (列数, 行数)
        self.grid_levels = [
            (6, 5),  # 最小（每页 30 张）
            (5, 4),  # 较小（每页 20 张）
            (4, 3),  # 默认（每页 12 张）
            (3, 2),  # 较大（每页 6 张）
            (2, 2),  # 大（每页 4 张）
            (1, 1)   # 超大（每页 1 张）
        ]
        self.current_level_idx = 2  # 默认 4x3 (12张)
        
        # 缩略图缓存池 (LRU OrderedDict，最大上限 150 以节约内存与 GDI 句柄)
        self.thumbnail_cache = OrderedDict()
        
        # 后台线程池（4线程，专用于超高速解码缩略图）
        self.thread_executor = ThreadPoolExecutor(max_workers=4)
        
        # 加载配置文件
        self.load_config()
        
        # 建立界面
        self.setup_ui()
        
        # 绑定全局快捷键
        self.bind_events()
        
    # --- 配置文件存取 ---
    def load_config(self):
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), CONFIG_FILE_NAME)
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.trash_folder = config.get("trash_folder", "")
            except Exception:
                pass
                
    def save_config(self):
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), CONFIG_FILE_NAME)
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump({"trash_folder": self.trash_folder}, f, ensure_ascii=False, indent=4)
        except Exception:
            pass

    # --- UI 框架绘制 ---
    def setup_ui(self):
        # 1. 顶部控制栏
        self.top_bar = tk.Frame(self.root, bg=BG_MAIN, height=60)
        self.top_bar.pack(fill=tk.X, side=tk.TOP, padx=20, pady=10)
        
        # 按钮：选择相册文件夹
        self.btn_select_folder = tk.Button(
            self.top_bar, text="📁 选择相册文件夹", font=self.font_bold, 
            bg=ACCENT_BLUE, fg="white", activebackground="#60a5fa", 
            activeforeground="white", bd=0, cursor="hand2", padx=15, pady=8,
            command=self.select_album_folder
        )
        self.btn_select_folder.pack(side=tk.LEFT)
        
        # 当前加载路径标签
        self.lbl_path = tk.Label(self.top_bar, text="请先选择包含照片的文件夹...", font=self.font_normal, bg=BG_MAIN, fg=TEXT_MUTED)
        self.lbl_path.pack(side=tk.LEFT, padx=15)
        
        # 排序控件容器
        self.sort_frame = tk.Frame(self.top_bar, bg=BG_MAIN)
        self.sort_frame.pack(side=tk.LEFT, padx=20)
        
        self.btn_sort_name = tk.Button(
            self.sort_frame, text="🔤 按名称", font=self.font_bold,
            bg=BG_CARD, fg=TEXT_MUTED, activebackground=BG_HOVER,
            activeforeground=TEXT_MAIN, bd=1, relief="solid",
            highlightthickness=0, borderwidth=1, highlightbackground=BORDER_COLOR,
            cursor="hand2", padx=10, pady=5
        )
        self.btn_sort_name.pack(side=tk.LEFT, padx=5)
        
        self.btn_sort_date = tk.Button(
            self.sort_frame, text="📅 按日期", font=self.font_bold,
            bg=BG_CARD, fg=TEXT_MUTED, activebackground=BG_HOVER,
            activeforeground=TEXT_MAIN, bd=1, relief="solid",
            highlightthickness=0, borderwidth=1, highlightbackground=BORDER_COLOR,
            cursor="hand2", padx=10, pady=5
        )
        self.btn_sort_date.pack(side=tk.LEFT, padx=5)
        
        # 绑定单击与双击事件到排序按钮上
        self.btn_sort_name.bind("<Button-1>", lambda e: self.on_sort_click("name"))
        self.btn_sort_name.bind("<Double-Button-1>", lambda e: self.on_sort_double_click("name"))
        
        self.btn_sort_date.bind("<Button-1>", lambda e: self.on_sort_click("date"))
        self.btn_sort_date.bind("<Double-Button-1>", lambda e: self.on_sort_double_click("date"))
        
        # 初始化更新排序按钮外观
        self.update_sort_buttons_ui()
        
        # 按钮：设置最近删除
        self.btn_set_trash = tk.Button(
            self.top_bar, text="⚙️ 设置“最近删除”文件夹", font=self.font_bold, 
            bg=BG_CARD, fg=TEXT_MAIN, activebackground=BG_HOVER, 
            activeforeground=TEXT_MAIN, bd=1, relief="solid", 
            highlightthickness=0, borderwidth=1, highlightbackground=BORDER_COLOR,
            cursor="hand2", padx=12, pady=6, command=self.set_trash_folder_dialog
        )
        self.btn_set_trash.pack(side=tk.RIGHT)
        
        # 2. 底部状态栏
        self.status_bar = tk.Frame(self.root, bg=BG_MAIN, height=35)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM, padx=20, pady=10)
        
        self.lbl_status = tk.Label(self.status_bar, text="就绪。支持滚轮翻页、Ctrl+加减缩放网格、左键滑动多选、右键单击详情、右键双击移至删除。", font=self.font_normal, bg=BG_MAIN, fg=TEXT_MUTED)
        self.lbl_status.pack(side=tk.LEFT)
        
        # 交互式分页导航容器
        self.page_nav_frame = tk.Frame(self.status_bar, bg=BG_MAIN)
        self.page_nav_frame.pack(side=tk.RIGHT)
        
        self.lbl_page_prefix = tk.Label(self.page_nav_frame, text="第 ", font=self.font_bold, bg=BG_MAIN, fg=ACCENT_BLUE)
        self.lbl_page_prefix.pack(side=tk.LEFT)
        
        self.entry_page = tk.Entry(
            self.page_nav_frame, width=4, font=self.font_bold, justify="center",
            bg=BG_CARD, fg=TEXT_MAIN, insertbackground=TEXT_MAIN, bd=0,
            highlightthickness=1, highlightbackground=BORDER_COLOR, highlightcolor=ACCENT_BLUE
        )
        self.entry_page.pack(side=tk.LEFT, padx=3)
        self.entry_page.insert(0, "0")
        self.entry_page.bind("<Return>", self.on_page_entry_submit)
        self.entry_page.bind("<FocusOut>", lambda e: self.update_page_entry_value())
        
        self.lbl_page_suffix = tk.Label(self.page_nav_frame, text=" / 0 页 (共 0 张)", font=self.font_bold, bg=BG_MAIN, fg=ACCENT_BLUE)
        self.lbl_page_suffix.pack(side=tk.LEFT)

        # 3. 主图片展示区域
        # 我们使用一个外部大框架承载，内部用 grid 自适应网格
        self.grid_container = tk.Frame(self.root, bg=BG_MAIN)
        self.grid_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=0)
        
        # 卡片控件引用列表，用于动态刷新和销毁
        self.card_widgets = []
        
        # 全局悬浮的“元数据详情卡片”（隐藏状态）
        self.meta_overlay = tk.Frame(
            self.root, bg=BG_CARD, bd=1, relief="solid", 
            highlightthickness=0, borderwidth=1, highlightbackground=BORDER_COLOR
        )
        self.lbl_meta_title = tk.Label(self.meta_overlay, text="📷 照片详细元数据", font=self.font_bold, bg=BG_CARD, fg=ACCENT_BLUE)
        self.lbl_meta_title.pack(anchor="w", padx=15, pady=(15, 8))
        
        self.txt_meta_content = tk.Text(self.meta_overlay, font=self.font_normal, bg=BG_MAIN, fg=TEXT_MAIN, bd=0, highlightthickness=0, width=32, height=12, wrap=tk.WORD)
        self.txt_meta_content.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))
        self.txt_meta_content.config(state=tk.DISABLED)
        
        # 绑定元数据卡片鼠标移出自动隐藏
        self.meta_overlay.bind("<Leave>", lambda e: self.hide_metadata_overlay())

    # --- 绑定全局事件 ---
    def bind_events(self):
        # 滚轮翻页 (兼容 Windows 滚轮事件)
        self.root.bind("<MouseWheel>", self.on_mouse_wheel)
        
        # 键盘缩放快捷键 (Ctrl + '+' / Ctrl + '-')
        self.root.bind("<Control-KeyPress-equal>", lambda e: self.change_grid_zoom(1))   # Ctrl + =
        self.root.bind("<Control-KeyPress-plus>", lambda e: self.change_grid_zoom(1))    # Ctrl + +
        self.root.bind("<Control-KeyPress-minus>", lambda e: self.change_grid_zoom(-1))  # Ctrl + -
        
        # 点击空白区域隐藏元数据卡片
        self.root.bind("<Button-1>", self.on_global_left_click, add="+")
        # 窗口大小改变后重绘
        self.root.bind("<Configure>", self.on_window_resize)

    # --- 文件夹选择与初始化 ---
    def select_album_folder(self):
        folder = filedialog.askdirectory(title="选择您的相册文件夹")
        if folder:
            self.image_folder = os.path.normpath(folder)
            self.lbl_path.config(text=f"当前路径: {self.image_folder}")
            
            # 扫描目录下所有的图片格式 (jpg, jpeg, png, bmp, webp)
            valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".jpg.large"}
            raw_paths = []
            self.thumbnail_cache.clear()  # 清空高速缓存，防止内存堆积和跨目录缓存干扰
            for root_dir, dirs, files in os.walk(self.image_folder):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in valid_exts:
                        raw_paths.append(os.path.join(root_dir, f))
            
            # 极速预取并缓存文件元数据，彻底断绝磁盘 I/O 阻塞
            self.image_items = []
            for p in raw_paths:
                try:
                    mtime = os.path.getmtime(p)
                except Exception:
                    mtime = 0.0
                self.image_items.append({
                    "path": p,
                    "name": os.path.basename(p),
                    "name_lower": os.path.basename(p).lower(),
                    "mtime": mtime
                })
            
            # 依据当前的排序模式应用内存排序
            self.apply_sorting()
            
            # 重置分页和选中状态
            self.current_page = 0
            self.selected_indices.clear()
            
            # 检查是否配置了“最近删除”
            if not self.trash_folder or not os.path.exists(self.trash_folder):
                messagebox.showinfo("提示", "您尚未设置“最近删除”暂存文件夹，请在接下来的弹窗中选择它的保存位置。")
                self.set_trash_folder_dialog()
            
            self.refresh_grid()

    def set_trash_folder_dialog(self):
        folder = filedialog.askdirectory(title="选择您的“最近删除”暂存文件夹位置")
        if folder:
            self.trash_folder = os.path.normpath(folder)
            self.save_config()
            messagebox.showinfo("配置成功", f"最近删除文件夹已设定为:\n{self.trash_folder}")
            self.log_status(f"“最近删除”文件夹配置完毕: {self.trash_folder}")
        else:
            if not self.trash_folder:
                self.log_status("警告: 必须配置“最近删除”文件夹，否则将无法使用快速双击移动删除功能。")

    # --- 滚轮翻页与缩放计算 ---
    def on_mouse_wheel(self, event):
        if not self.image_items:
            return
            
        cols, rows = self.grid_levels[self.current_level_idx]
        page_size = cols * rows
        max_pages = (len(self.image_items) + page_size - 1) // page_size
        
        # 使用防抖暂存目标页码，阻止滚动中间过程高频触发渲染
        if not hasattr(self, "scroll_target_page"):
            self.scroll_target_page = self.current_page
            
        if event.delta > 0:
            # 向上滚，上一页
            if self.scroll_target_page > 0:
                self.scroll_target_page -= 1
        else:
            # 向下滚，下一页
            if self.scroll_target_page < max_pages - 1:
                self.scroll_target_page += 1
                
        # 100ms 防抖，当用户滚动停顿 100ms 后才一次性渲染最终的目标页
        if hasattr(self, "scroll_after_id") and self.scroll_after_id:
            self.root.after_cancel(self.scroll_after_id)
            self.scroll_after_id = None
            
        self.scroll_after_id = self.root.after(100, self.execute_scroll_render)

    def execute_scroll_render(self):
        self.scroll_after_id = None
        if hasattr(self, "scroll_target_page"):
            if self.current_page != self.scroll_target_page:
                self.current_page = self.scroll_target_page
                self.refresh_grid()

    def change_grid_zoom(self, delta):
        if not self.image_items:
            return
            
        old_cols, old_rows = self.grid_levels[self.current_level_idx]
        old_page_size = old_cols * old_rows
        first_visible_idx = self.current_page * old_page_size
        
        # 调整缩放级别
        new_idx = self.current_level_idx + delta
        if 0 <= new_idx < len(self.grid_levels):
            self.current_level_idx = new_idx
            
            # 计算新每页容量
            new_cols, new_rows = self.grid_levels[self.current_level_idx]
            new_page_size = new_cols * new_rows
            
            # 尽量保持之前页面的首张照片依然在当前页视野中
            self.current_page = first_visible_idx // new_page_size
            self.refresh_grid()
            self.log_status(f"网格已调整为: {new_cols} 列 x {new_rows} 行 (每页 {new_page_size} 张)")

    # --- 界面网格刷新与异步渲染 ---
    def refresh_grid(self):
        # 隐藏元数据浮层
        self.hide_metadata_overlay()
        
        # 增加渲染校验令牌，防止后台过时线程的回调覆盖当前页面
        self.loading_token += 1
        current_token = self.loading_token
        
        # 重置/熔断线程池以确保当前页面具备最高的加载优先级，取消之前积累的所有非当前页预加载任务
        try:
            self.thread_executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            try:
                self.thread_executor.shutdown(wait=False)
            except Exception:
                pass
        self.thread_executor = ThreadPoolExecutor(max_workers=4)
        
        # 清理旧的所有卡片控件
        for widget in self.card_widgets:
            widget.destroy()
        self.card_widgets.clear()
        
        if not self.image_items:
            self.entry_page.delete(0, tk.END)
            self.entry_page.insert(0, "0")
            self.lbl_page_suffix.config(text=" / 0 页 (共 0 张)")
            return
            
        cols, rows = self.grid_levels[self.current_level_idx]
        page_size = cols * rows
        
        # 计算当前分页的起始和终点索引
        start_idx = self.current_page * page_size
        end_idx = min(start_idx + page_size, len(self.image_items))
        page_photos = self.image_items[start_idx:end_idx]
        
        # 配置网格容器的行列权重，使其平分可用窗口宽度和高度
        for r in range(rows):
            self.grid_container.grid_rowconfigure(r, weight=1, uniform="row")
        for c in range(cols):
            self.grid_container.grid_columnconfigure(c, weight=1, uniform="col")
            
        # 根据当前布局，计算单张卡片的理论最大像素尺寸，用于高画质高质量缩放
        # 我们在这里先获取窗口大概尺寸，若尚未完全渲染，使用预估尺寸
        self.root.update_idletasks()
        container_w = max(self.grid_container.winfo_width(), 600)
        container_h = max(self.grid_container.winfo_height(), 400)
        
        card_w = max((container_w // cols) - 16, 80)
        card_h = max((container_h // rows) - 26, 80)
        
        # 循环铺设照片卡片占位符 (骨架屏)
        for idx_on_page, item in enumerate(page_photos):
            path = item["path"]
            global_idx = start_idx + idx_on_page
            r = idx_on_page // cols
            c = idx_on_page % cols
            
            # 创建照片卡片底层 Container
            card = tk.Frame(
                self.grid_container, bg=BG_CARD, bd=0, 
                highlightthickness=1, highlightbackground=BORDER_COLOR
            )
            card.grid(row=r, column=c, padx=8, pady=8, sticky="nsew")
            self.card_widgets.append(card)
            
            # 图片显示容器 Label
            lbl_img = tk.Label(card, text="⌛ 加载中...", font=self.font_small, bg=BG_CARD, fg=TEXT_MUTED)
            lbl_img.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
            
            # 文件名展示 Label
            name_text = os.path.basename(path)
            # 缩写显示过长的文件名
            if len(name_text) > 18:
                name_text = name_text[:10] + "..." + name_text[-6:]
            lbl_name = tk.Label(card, text=name_text, font=self.font_small, bg=BG_CARD, fg=TEXT_MUTED)
            lbl_name.pack(fill=tk.X, side=tk.BOTTOM, pady=(0, 4))
            
            # 关联小组件便于划选查找
            card.lbl_img = lbl_img
            card.lbl_name = lbl_name
            card.global_idx = global_idx
            card.path = path
            
            # 绑定鼠标事件 (包括卡片容器及其子 Label)
            for widget in (card, lbl_img, lbl_name):
                # 左键点击与拖拽划选
                widget.bind("<Button-1>", lambda e, g=global_idx: self.on_card_left_click(e, g))
                widget.bind("<B1-Motion>", self.on_card_left_drag)
                # 右键单击（区分双击）
                widget.bind("<Button-3>", lambda e, g=global_idx: self.on_card_right_click(e, g))
                widget.bind("<Double-Button-3>", lambda e, g=global_idx: self.on_card_right_double_click(e, g))
            
            # 绘制当前选中的高亮样式
            if global_idx in self.selected_indices:
                self.highlight_card_selected(card, True)
                
            # 检查是否有缩略图缓存，若有直接主线程秒开渲染，避免闪烁
            cache_key = (path, card_w, card_h)
            if cache_key in self.thumbnail_cache:
                lbl_img.config(image=self.thumbnail_cache[cache_key], text="")
            else:
                # 后台多线程任务分发：加载并高效裁剪该照片
                self.thread_executor.submit(
                    self.load_thumbnail_worker, path, card_w, card_h, current_token, lbl_img
                )
                
        # 更新状态栏分页数据
        total_photos = len(self.image_items)
        total_pages = (total_photos + page_size - 1) // page_size
        self.update_page_entry_value()
        self.lbl_page_suffix.config(text=f" / {total_pages} 页 (共 {total_photos} 张)")
        
        # 自动异步预加载后面 3 页的内容到内存缓存中
        self.preload_future_pages(start_idx, page_size, card_w, card_h)
        
    def load_thumbnail_worker(self, path, w, h, token, target_label):
        """后台缩略图解码与高画质缩放"""
        # 熔断校验：如果用户已经翻页，直接丢弃任务，停止多余的 I/O
        if token != self.loading_token:
            return
            
        try:
            with Image.open(path) as img:
                # 第二次熔断校验：在执行高延迟的 fit 缩放操作前校验
                if token != self.loading_token:
                    return
                    
                thumb = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)
                if thumb.mode not in ("RGB", "RGBA"):
                    thumb = thumb.convert("RGB")
                
                # 第三次熔断校验：回调主线程前校验
                if token != self.loading_token:
                    return
                    
                # 回调主线程进行界面重绘 (Tkinter 禁止在子线程操作 GUI 组件)
                self.root.after(0, lambda: self.render_thumbnail_callback(path, thumb, w, h, token, target_label))
        except Exception:
            # 若解码损坏的图片失败，则在主线程渲染错误占位符
            self.root.after(0, lambda: self.render_error_callback(token, target_label))
            
    def render_thumbnail_callback(self, path, pil_image, w, h, token, target_label):
        # 校验页面加载令牌，防止用户飞速滚动滚轮时旧翻页的回调堆积打乱当前页面
        if token != self.loading_token:
            return
            
        try:
            # 转换成 PhotoImage（必须在主线程创建）
            tk_photo = ImageTk.PhotoImage(pil_image)
            cache_key = (path, w, h)
            
            # LRU 缓存策略：存在时移到最右，不存在时加入并检查容量上限
            if cache_key in self.thumbnail_cache:
                self.thumbnail_cache.move_to_end(cache_key)
            else:
                self.thumbnail_cache[cache_key] = tk_photo
                # 最大缓存 150 张缩略图，超出时驱逐最老缓存并释放句柄，阻止内存无限递增
                if len(self.thumbnail_cache) > 150:
                    old_key, old_val = self.thumbnail_cache.popitem(last=False)
                    del old_val
            
            # 更新界面小组件
            target_label.config(image=tk_photo, text="")
        except Exception:
            pass
            
    def render_error_callback(self, token, target_label):
        if token != self.loading_token:
            return
        target_label.config(text="❌ 图片损坏", fg=ACCENT_RED)

    # --- 高亮与卡片状态变化 ---
    def highlight_card_selected(self, card, is_selected):
        if is_selected:
            card.config(highlightbackground=ACCENT_BLUE, highlightthickness=2)
            card.lbl_name.config(fg=ACCENT_BLUE)
        else:
            card.config(highlightbackground=BORDER_COLOR, highlightthickness=1)
            card.lbl_name.config(fg=TEXT_MUTED)

    # --- 左键单选及划选逻辑 ---
    def on_card_left_click(self, event, global_idx):
        self.drag_start_index = global_idx
        self.drag_selected_indices = {global_idx}
        
        # 单击取反选中状态
        self.toggle_selection(global_idx)
        
    def on_card_left_drag(self, event):
        # 寻找鼠标拖拽划过的小组件
        widget = self.root.winfo_containing(event.x_root, event.y_root)
        if not widget:
            return
            
        # 向上级容器查找，直到定位到卡片顶级控件
        card = self.find_parent_card(widget)
        if card and hasattr(card, "global_idx"):
            g_idx = card.global_idx
            if g_idx not in self.drag_selected_indices:
                self.drag_selected_indices.add(g_idx)
                # 划过的照片强制设为选中
                self.toggle_selection(g_idx, force_select=True)
                
    def find_parent_card(self, widget):
        curr = widget
        while curr:
            if curr in self.card_widgets:
                return curr
            curr = curr.master
        return None

    def toggle_selection(self, global_idx, force_select=None):
        if force_select is True:
            self.selected_indices.add(global_idx)
        elif force_select is False:
            self.selected_indices.discard(global_idx)
        else:
            if global_idx in self.selected_indices:
                self.selected_indices.remove(global_idx)
            else:
                self.selected_indices.add(global_idx)
                
        # 实时重绘该卡片的边框高亮样式
        for card in self.card_widgets:
            if card.global_idx == global_idx:
                self.highlight_card_selected(card, global_idx in self.selected_indices)
                break
                
        # 状态栏计数更新
        sel_count = len(self.selected_indices)
        if sel_count > 0:
            self.lbl_status.config(text=f"已选择 {sel_count} 张照片。按“Delete”键或右键双击可将其安全移入最近删除。", fg=TEXT_MAIN)
        else:
            self.lbl_status.config(text="就绪。支持滚轮翻页、Ctrl+加减缩放网格、左键滑动多选、右键单击详情、右键双击移至删除。", fg=TEXT_MUTED)

    def on_global_left_click(self, event):
        # 如果点击的区域不在元数据浮层内，自动隐藏它
        widget = self.root.winfo_containing(event.x_root, event.y_root)
        if not widget:
            return
            
        # 检查是否属于元数据浮层的子孙控件
        is_inside_meta = False
        curr = widget
        while curr:
            if curr == self.meta_overlay:
                is_inside_meta = True
                break
            curr = curr.master
            
        if not is_inside_meta:
            self.hide_metadata_overlay()

    # --- 右键单击元数据悬浮窗展示 ---
    def on_card_right_click(self, event, global_idx):
        # 区分双击机制：延迟 250ms 执行单右击
        if self.right_click_timer:
            self.root.after_cancel(self.right_click_timer)
            self.right_click_timer = None
            
        self.right_click_timer = self.root.after(250, lambda: self.show_metadata_overlay(event, global_idx))

    def show_metadata_overlay(self, event, global_idx):
        if global_idx >= len(self.image_items):
            return
            
        path = self.image_items[global_idx]["path"]
        
        # 快速提取照片的详细 EXIF 元数据
        metadata = self.get_exif_metadata(path)
        
        self.txt_meta_content.config(state=tk.NORMAL)
        self.txt_meta_content.delete("1.0", tk.END)
        
        for k, v in metadata.items():
            self.txt_meta_content.insert(tk.END, f"■ {k}:\n  {v}\n\n")
            
        self.txt_meta_content.config(state=tk.DISABLED)
        
        # 计算悬浮位置，防止窗体溢出边界
        x = event.x_root - self.root.winfo_rootx() + 10
        y = event.y_root - self.root.winfo_rooty() + 10
        
        self.root.update_idletasks()
        overlay_w = self.meta_overlay.winfo_width()
        overlay_h = self.meta_overlay.winfo_height()
        
        if x + overlay_w > self.root.winfo_width():
            x = x - overlay_w - 20
        if y + overlay_h > self.root.winfo_height():
            y = y - overlay_h - 20
            
        # 摆放位置并拉起
        self.meta_overlay.place(x=x, y=y)
        self.meta_overlay.lift()

    def hide_metadata_overlay(self):
        self.meta_overlay.place_forget()

    def get_exif_metadata(self, path):
        metadata = {
            "文件名": os.path.basename(path),
            "存储路径": path,
            "文件大小": f"{os.path.getsize(path) / (1024*1024):.2f} MB",
            "分辨率": "未知",
            "拍摄时间": "未知",
            "相机型号": "未知",
            "GPS 坐标": "未知"
        }
        
        try:
            with Image.open(path) as img:
                metadata["分辨率"] = f"{img.width} x {img.height} 像素"
                
                # 读取 Exif
                exif_data = img._getexif()
                if exif_data:
                    exif = {TAGS.get(tag, tag): value for tag, value in exif_data.items()}
                    
                    # 1. 拍摄时间
                    date_time = exif.get("DateTimeOriginal") or exif.get("DateTime")
                    if date_time:
                        metadata["拍摄时间"] = str(date_time)
                        
                    # 2. 相机品牌和型号
                    make = exif.get("Make", "")
                    model = exif.get("Model", "")
                    if make or model:
                        metadata["相机型号"] = f"{make} {model}".strip()
                        
                    # 3. GPS 坐标提取与度分秒换算
                    gps_info = exif.get("GPSInfo")
                    if gps_info:
                        gps_data = {GPSTAGS.get(t, t): gps_info[t] for t in gps_info}
                        
                        lat = gps_data.get("GPSLatitude")
                        lat_ref = gps_data.get("GPSLatitudeRef")
                        lon = gps_data.get("GPSLongitude")
                        lon_ref = gps_data.get("GPSLongitudeRef")
                        
                        if lat and lon and lat_ref and lon_ref:
                            # 经纬度转换度分秒格式函数
                            def to_decimal(val):
                                d = float(val[0])
                                m = float(val[1])
                                s = float(val[2])
                                return d + (m / 60.0) + (s / 3600.0)
                            
                            dec_lat = to_decimal(lat)
                            if lat_ref != 'N':
                                dec_lat = -dec_lat
                            dec_lon = to_decimal(lon)
                            if lon_ref != 'E':
                                dec_lon = -dec_lon
                                
                            metadata["GPS 坐标"] = f"{dec_lat:.6f}° , {dec_lon:.6f}°"
        except Exception:
            pass
            
        return metadata

    # --- 右键双击及 Delete 移动删除逻辑 ---
    def on_card_right_double_click(self, event, global_idx):
        # 拦截单右击定时器
        if self.right_click_timer:
            self.root.after_cancel(self.right_click_timer)
            self.right_click_timer = None
            
        self.hide_metadata_overlay()
        self.move_to_trash([global_idx])

    def move_to_trash(self, indices_to_delete):
        if not self.trash_folder or not os.path.exists(self.trash_folder):
            messagebox.showerror("错误", "“最近删除”暂存文件夹尚未配置或已被移动，请重新配置。")
            self.set_trash_folder_dialog()
            return
            
        # 过滤合规索引
        valid_indices = [idx for idx in indices_to_delete if 0 <= idx < len(self.image_items)]
        if not valid_indices:
            return
            
        # 提取文件路径
        paths_to_move = [self.image_items[idx]["path"] for idx in valid_indices]
        
        # 安全转移文件到最近删除中
        moved_count = 0
        try:
            for src_file in paths_to_move:
                filename = os.path.basename(src_file)
                dest_file = os.path.join(self.trash_folder, filename)
                
                # 冲突保护
                if os.path.exists(dest_file):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while True:
                        new_name = f"{base}_{counter}{ext}"
                        dest_file = os.path.join(self.trash_folder, new_name)
                        if not os.path.exists(dest_file):
                            break
                        counter += 1
                        
                shutil.move(src_file, dest_file)
                moved_count += 1
                
            # 从全局数据源中剔除这些图片路径
            # 先对索引逆序排序，防止从前删会导致后续索引崩塌
            for idx in sorted(valid_indices, reverse=True):
                self.image_items.pop(idx)
                
            # 清理全局选中缓存
            self.selected_indices.clear()
            
            # 计算边界：若删完了该页最后一批导致当前页码越界，向前跳一页
            cols, rows = self.grid_levels[self.current_level_idx]
            page_size = cols * rows
            max_pages = max(1, (len(self.image_items) + page_size - 1) // page_size)
            if self.current_page >= max_pages:
                self.current_page = max_pages - 1
                
            # 重绘网格
            self.refresh_grid()
            
            self.log_status(f"成功将 {moved_count} 张照片移入最近删除 ({self.trash_folder})。")
            
        except Exception as e:
            messagebox.showerror("移动失败", f"部分文件移动时发生错误:\n{e}")

    # --- 窗口改变大小重绘 ---
    def on_window_resize(self, event):
        # 仅响应主窗口 (root) 的大小改变事件，过滤所有子组件的 Configure 事件防止无限渲染环路
        if event.widget != self.root:
            return
            
        # 检查像素宽高是否发生了真实变化
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        
        if not hasattr(self, "last_width"):
            self.last_width = w
            self.last_height = h
            return
            
        if w == self.last_width and h == self.last_height:
            return
            
        self.last_width = w
        self.last_height = h
        
        # 300ms 防抖重绘，避免连续拖拽导致高频闪烁
        if hasattr(self, "_resize_after_id") and self._resize_after_id:
            self.root.after_cancel(self._resize_after_id)
            
        self._resize_after_id = self.root.after(300, self.execute_resize_redraw)
        
    def execute_resize_redraw(self):
        self._resize_after_id = None
        if self.image_items:
            self.refresh_grid()

    # --- 排序与自动预加载系统 ---
    def on_sort_click(self, mode):
        # 仅在切换模式时将正序设为默认
        if self.sort_mode != mode:
            self.sort_mode = mode
            self.sort_descending = False
            self.apply_sorting()
            self.refresh_grid()
            self.update_sort_buttons_ui()
            
    def on_sort_double_click(self, mode):
        # 双击切换正序/倒序
        self.sort_mode = mode
        self.sort_descending = not self.sort_descending
        self.apply_sorting()
        self.refresh_grid()
        self.update_sort_buttons_ui()

    def apply_sorting(self):
        if not self.image_items:
            return
            
        # 记录排序前首个可见的图片路径，使得排序后页面视点能尽量跟随该图
        current_visible_file = ""
        cols, rows = self.grid_levels[self.current_level_idx]
        page_size = cols * rows
        current_visible_idx = self.current_page * page_size
        
        if 0 <= current_visible_idx < len(self.image_items):
            current_visible_file = self.image_items[current_visible_idx]["path"]

        if self.sort_mode == "name":
            # 纯内存秒级快速排序，直接读取预存文件名（忽略大小写）
            self.image_items.sort(key=lambda x: x["name_lower"], reverse=self.sort_descending)
        elif self.sort_mode == "date":
            # 纯内存秒级快速排序，直接读取预存的 mtime 时间戳
            self.image_items.sort(key=lambda x: x["mtime"], reverse=self.sort_descending)

        # 重算当前页码以锁定之前可见的图片
        if current_visible_file:
            try:
                paths = [x["path"] for x in self.image_items]
                new_idx = paths.index(current_visible_file)
                self.current_page = new_idx // page_size
            except ValueError:
                self.current_page = 0

    def update_sort_buttons_ui(self):
        # 组装状态标识符号 (▲ 表示正序即最早最前，▼ 表示倒序)
        arrow = " ▼ 倒序" if self.sort_descending else " ▲ 正序"
        
        if self.sort_mode == "name":
            self.btn_sort_name.config(text=f"🔤 按名称{arrow}", bg=ACCENT_BLUE, fg="white", activebackground="#60a5fa", activeforeground="white")
            self.btn_sort_date.config(text="📅 按日期", bg=BG_CARD, fg=TEXT_MUTED, activebackground=BG_HOVER, activeforeground=TEXT_MAIN)
        else:
            self.btn_sort_name.config(text="🔤 按名称", bg=BG_CARD, fg=TEXT_MUTED, activebackground=BG_HOVER, activeforeground=TEXT_MAIN)
            self.btn_sort_date.config(text=f"📅 按日期{arrow}", bg=ACCENT_BLUE, fg="white", activebackground="#60a5fa", activeforeground="white")

    def preload_future_pages(self, start_idx, page_size, card_w, card_h):
        # 预加载后续 3 页的内容到后台缓存中
        preload_start = start_idx + page_size
        preload_end = min(preload_start + 3 * page_size, len(self.image_items))
        
        if preload_start >= len(self.image_items):
            return
            
        future_photos = [self.image_items[idx]["path"] for idx in range(preload_start, preload_end)]
        
        for path in future_photos:
            cache_key = (path, card_w, card_h)
            if cache_key not in self.thumbnail_cache:
                self.thread_executor.submit(
                    self.load_thumbnail_preload_worker, path, card_w, card_h
                )

    def load_thumbnail_preload_worker(self, path, w, h):
        try:
            with Image.open(path) as img:
                thumb = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)
                if thumb.mode not in ("RGB", "RGBA"):
                    thumb = thumb.convert("RGB")
                
                # 转换 PhotoImage 必须在主线程队列中完成
                self.root.after(0, lambda: self.save_preload_callback(path, thumb, w, h))
        except Exception:
            pass

    def save_preload_callback(self, path, pil_image, w, h):
        cache_key = (path, w, h)
        if cache_key not in self.thumbnail_cache:
            try:
                tk_photo = ImageTk.PhotoImage(pil_image)
                self.thumbnail_cache[cache_key] = tk_photo
                # LRU 缓存策略上限控制，最大 150 张，超出的释放 GDI 句柄
                if len(self.thumbnail_cache) > 150:
                    old_key, old_val = self.thumbnail_cache.popitem(last=False)
                    del old_val
            except Exception:
                pass
        else:
            self.thumbnail_cache.move_to_end(cache_key)

    def on_page_entry_submit(self, event=None):
        if not self.image_items:
            return
            
        cols, rows = self.grid_levels[self.current_level_idx]
        page_size = cols * rows
        max_pages = (len(self.image_items) + page_size - 1) // page_size
        
        try:
            val = int(self.entry_page.get().strip())
            # 用户输入的页码是 1-indexed (如 1 到 max_pages)
            if 1 <= val <= max_pages:
                self.current_page = val - 1
                # 同步更新滚动目标页码，防止滚轮冲突
                self.scroll_target_page = self.current_page
                self.refresh_grid()
            else:
                self.update_page_entry_value()
        except ValueError:
            self.update_page_entry_value()
            
        # 让输入框失去焦点，外观更干净整洁
        self.root.focus_set()

    def update_page_entry_value(self):
        self.entry_page.delete(0, tk.END)
        self.entry_page.insert(0, str(self.current_page + 1))

    # --- 打印状态日志 ---
    def log_status(self, text):
        self.lbl_status.config(text=text, fg=TEXT_MUTED)

if __name__ == "__main__":
    root = tk.Tk()
    app = PhotoManagerApp(root)
    
    # 额外绑定键盘 Delete 键，支持选中后批量一键移动
    root.bind("<Delete>", lambda e: app.move_to_trash(list(app.selected_indices)))
    
    root.mainloop()
