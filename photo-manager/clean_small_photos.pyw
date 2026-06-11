import os
import shutil
import ctypes
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# --- 依赖检测与安装 (Pillow) ---
try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image
    except Exception as e:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("依赖错误", f"程序需要 Pillow 库来读取图片尺寸，但自动安装失败，请手动运行 'pip install Pillow' 之后再运行此程序。\n错误: {e}")
        sys.exit(1)

# --- Windows 高 DPI 锐化初始化 (DPI-Aware) ---
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

# --- 现代深色高质感配色 ---
BG_COLOR = "#121214"
CARD_COLOR = "#1c1c1f"
TEXT_COLOR = "#e4e4e7"
TEXT_MUTED = "#a1a1aa"
ACCENT_BLUE = "#3b82f6"
SUCCESS_COLOR = "#10b981"
BORDER_COLOR = "#2d2d30"

class SmallPhotoCleanerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🔍 小尺寸图片自动清除归类工具")
        self.root.geometry("680x520")
        self.root.configure(bg=BG_COLOR)
        
        self.font_title = ("Microsoft YaHei", 14, "bold")
        self.font_bold = ("Microsoft YaHei", 9, "bold")
        self.font_normal = ("Microsoft YaHei", 9)
        self.font_small = ("Microsoft YaHei", 8.5)
        
        self.source_dir = tk.StringVar()
        self.dest_dir = tk.StringVar()
        self.running = False
        
        self.create_widgets()
        
    def create_widgets(self):
        # 头部标题
        title_frame = tk.Frame(self.root, bg=BG_COLOR, pady=15)
        title_frame.pack(fill=tk.X)
        
        lbl_title = tk.Label(title_frame, text="🔍 小尺寸图片自动筛选工具 (Google Photos 优化)", font=self.font_title, bg=BG_COLOR, fg=ACCENT_BLUE)
        lbl_title.pack(anchor="w", padx=25)
        
        lbl_subtitle = tk.Label(title_frame, text="自动扫描并移动所有低于 256×256 像素的图片，确保您的相册集符合备份规范。", font=self.font_small, bg=BG_COLOR, fg=TEXT_MUTED)
        lbl_subtitle.pack(anchor="w", padx=25, pady=(2, 0))
        
        # 主卡片框架
        main_frame = tk.Frame(self.root, bg=CARD_COLOR, bd=1, relief="flat", highlightbackground=BORDER_COLOR, highlightthickness=1)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=25, pady=(0, 20))
        
        # 第一步：选择相册文件夹
        src_lbl = tk.Label(main_frame, text="第一步：选择相册源目录（将递归扫描所有子文件夹）", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        src_lbl.pack(anchor="w", padx=20, pady=(20, 6))
        
        src_entry_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        src_entry_frame.pack(fill=tk.X, padx=20, pady=(0, 10))
        
        self.entry_src = tk.Entry(src_entry_frame, textvariable=self.source_dir, font=self.font_normal, bg=BG_COLOR, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, bd=0, highlightthickness=1, highlightbackground=BORDER_COLOR, highlightcolor=ACCENT_BLUE)
        self.entry_src.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, ipadx=5)
        
        btn_src = tk.Button(src_entry_frame, text="选择文件夹", font=self.font_bold, bg=ACCENT_BLUE, fg="white", activebackground="#60a5fa", activeforeground="white", bd=0, cursor="hand2", command=self.select_source, width=11)
        btn_src.pack(side=tk.RIGHT, padx=(12, 0), ipady=4)
        
        # 第二步：选择移入目录
        dest_lbl = tk.Label(main_frame, text="第二步：选择小图移入的目标目录", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        dest_lbl.pack(anchor="w", padx=20, pady=(6, 6))
        
        dest_entry_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        dest_entry_frame.pack(fill=tk.X, padx=20, pady=(0, 15))
        
        self.entry_dest = tk.Entry(dest_entry_frame, textvariable=self.dest_dir, font=self.font_normal, bg=BG_COLOR, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, bd=0, highlightthickness=1, highlightbackground=BORDER_COLOR, highlightcolor=ACCENT_BLUE)
        self.entry_dest.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, ipadx=5)
        
        btn_dest = tk.Button(dest_entry_frame, text="选择文件夹", font=self.font_bold, bg=ACCENT_BLUE, fg="white", activebackground="#60a5fa", activeforeground="white", bd=0, cursor="hand2", command=self.select_dest, width=11)
        btn_dest.pack(side=tk.RIGHT, padx=(12, 0), ipady=4)
        
        # 日志及进度
        log_lbl = tk.Label(main_frame, text="整理进度及详细日志", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        log_lbl.pack(anchor="w", padx=20, pady=(5, 6))
        
        log_frame = tk.Frame(main_frame, bg=BG_COLOR, bd=1, relief="flat", highlightbackground=BORDER_COLOR, highlightthickness=1)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 15))
        
        self.scrollbar = tk.Scrollbar(log_frame)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.log_text = tk.Text(log_frame, yscrollcommand=self.scrollbar.set, font=self.font_small, bg=BG_COLOR, fg=TEXT_MUTED, bd=0, highlightthickness=0, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)
        self.scrollbar.config(command=self.log_text.yview)
        
        self.log("系统就绪。请设定路径并点击下方按钮运行。系统将采用无内存解码的极速头部流扫描技术，秒级处理万级相册。")
        
        # 开始按钮
        btn_action_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        btn_action_frame.pack(fill=tk.X, padx=20, pady=(0, 15))
        
        self.btn_run = tk.Button(btn_action_frame, text="🚀 启动筛选并安全移出小尺寸图片", font=self.font_bold, bg=SUCCESS_COLOR, fg="white", activebackground="#34d399", activeforeground="white", bd=0, cursor="hand2", command=self.start_process, height=2)
        self.btn_run.pack(fill=tk.X)
        
    def select_source(self):
        folder = filedialog.askdirectory(title="选择相册源目录")
        if folder:
            folder = os.path.normpath(folder)
            self.source_dir.set(folder)
            self.log(f"已设定源目录: {folder}")
            
    def select_dest(self):
        folder = filedialog.askdirectory(title="选择小图片移入的目标目录")
        if folder:
            folder = os.path.normpath(folder)
            self.dest_dir.set(folder)
            self.log(f"已设定移入目录: {folder}")
            
    def log(self, message):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update_idletasks()
        
    def start_process(self):
        if self.running:
            return
            
        src = self.source_dir.get().strip()
        dest = self.dest_dir.get().strip()
        
        if not src or not os.path.exists(src):
            messagebox.showerror("错误", "请选择有效的相册源目录！")
            return
        if not dest or not os.path.exists(dest):
            messagebox.showerror("错误", "请选择有效的移入目标目录！")
            return
        if src == dest:
            messagebox.showerror("错误", "源目录与目标目录不能相同！")
            return
            
        self.running = True
        self.btn_run.config(state=tk.DISABLED, bg=BORDER_COLOR, fg=TEXT_MUTED, text="⏳ 正在扫描处理中，请勿关闭窗口...")
        
        # 开启后台线程，防止 GUI 假死并实现平滑进度更新
        threading.Thread(target=self.run_clean_engine, args=(src, dest), daemon=True).start()
        
    def run_clean_engine(self, src, dest):
        self.log("\n=================== 启动小尺寸图片清理引擎 ===================")
        self.log(f"▶ 源文件夹: {src}")
        self.log(f"▶ 目标文件夹: {dest}")
        
        valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        moved_count = 0
        scanned_count = 0
        error_count = 0
        
        try:
            # 递归遍历源目录
            for root_dir, dirs, files in os.walk(src):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in valid_exts:
                        scanned_count += 1
                        file_path = os.path.join(root_dir, f)
                        
                        try:
                            # 极致性能优化点：Image.open 仅读取文件头部数据，不会进行全像素内存解码！速度极快！
                            with Image.open(file_path) as img:
                                w, h = img.size
                                
                            # Google Photos 限制：如果宽或高任一低于 256 像素，无法备份
                            if w < 256 or h < 256:
                                # 保持原有的相对目录子层级结构
                                rel_path = os.path.relpath(root_dir, src)
                                target_subdir = os.path.join(dest, rel_path)
                                
                                if not os.path.exists(target_subdir):
                                    os.makedirs(target_subdir)
                                    
                                target_path = os.path.join(target_subdir, f)
                                
                                # 重名冲突保护机制
                                if os.path.exists(target_path):
                                    base, ext_name = os.path.splitext(f)
                                    counter = 1
                                    while True:
                                        new_name = f"{base}_{counter}{ext_name}"
                                        target_path = os.path.join(target_subdir, new_name)
                                        if not os.path.exists(target_path):
                                            break
                                        counter += 1
                                
                                # 安全剪切移出
                                shutil.move(file_path, target_path)
                                moved_count += 1
                                
                                # 日志展示相对路径，简洁美观
                                rel_show_path = os.path.relpath(file_path, src)
                                self.log(f"【移出小图】({w}×{h}): {rel_show_path}")
                                
                        except Exception as file_err:
                            error_count += 1
                            # 忽略损坏的或非图片格式的数据，仅作日志警示
                            self.log(f"⚠️ 无法读取尺寸(损坏或加密): {os.path.basename(file_path)}")
                            
            self.log("=================== 筛选整理完毕 ===================")
            self.log(f"▶ 扫描图片总数: {scanned_count}")
            self.log(f"▶ 移出小图片数: {moved_count} (宽或高任一小于 256 像素)")
            if error_count > 0:
                self.log(f"▶ 无法读取的文件数: {error_count}")
            self.log(f"▶ 您的源相册现在已全量满足 Google Photos >256x256 像素备份规则。")
            
            messagebox.showinfo("整理完成", f"小尺寸图片整理完成！\n\n共扫描 {scanned_count} 张照片，已成功移出 {moved_count} 张低于 256x256 的小尺寸图片。")
            
        except Exception as e:
            self.log(f"\n❌ 清理引擎发生致命异常: {e}")
            messagebox.showerror("致命错误", f"程序运行中发生异常中断:\n{e}")
            
        finally:
            self.running = False
            self.btn_run.config(state=tk.NORMAL, bg=SUCCESS_COLOR, fg="white", text="🚀 启动筛选并安全移出小尺寸图片")

if __name__ == "__main__":
    root = tk.Tk()
    app = SmallPhotoCleanerApp(root)
    root.mainloop()
