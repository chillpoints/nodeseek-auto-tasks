import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# 界面风格配置（深色高质感配色系统）
BG_COLOR = "#1e1e2e"          # 底色
CARD_COLOR = "#252538"        # 容器背景色
TEXT_COLOR = "#cdd6f4"        # 主文字色
TEXT_MUTED = "#a6adc8"        # 辅助/说明文字色
ACCENT_COLOR = "#89b4fa"      # 蓝色高亮
SUCCESS_COLOR = "#a6e3a1"     # 绿色成功高亮
BORDER_COLOR = "#313244"      # 边框色

class FileMoverApp:
    def __init__(self, root):
        self.root = root
        self.root.title("📸 动态照片同名 MP4 整理工具")
        self.root.geometry("680x550")
        self.root.configure(bg=BG_COLOR)
        
        # 字体设置
        self.font_title = ("Microsoft YaHei", 15, "bold")
        self.font_bold = ("Microsoft YaHei", 9, "bold")
        self.font_normal = ("Microsoft YaHei", 9)
        self.font_small = ("Microsoft YaHei", 9)
        
        self.source_dir = tk.StringVar()
        self.dest_dir = tk.StringVar()
        
        self.create_widgets()
        
    def create_widgets(self):
        # 头部标题区域
        title_frame = tk.Frame(self.root, bg=BG_COLOR, pady=15)
        title_frame.pack(fill=tk.X)
        
        lbl_title = tk.Label(title_frame, text="📸 动态照片同名 MP4 整理工具", font=self.font_title, bg=BG_COLOR, fg=ACCENT_COLOR)
        lbl_title.pack(anchor="w", padx=25)
        
        lbl_subtitle = tk.Label(title_frame, text="识别并安全移动与 JPG/JPEG 同名的 MP4 视频，仅保留单独视频与静态照片。", font=self.font_small, bg=BG_COLOR, fg=TEXT_MUTED)
        lbl_subtitle.pack(anchor="w", padx=25, pady=(2, 0))
        
        # 主卡片容器
        main_frame = tk.Frame(self.root, bg=CARD_COLOR, bd=1, relief="flat", highlightbackground=BORDER_COLOR, highlightthickness=1)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=25, pady=(0, 25))
        
        # 选择源文件夹
        src_lbl = tk.Label(main_frame, text="第一步：选择相册文件夹（源目录）", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        src_lbl.pack(anchor="w", padx=20, pady=(20, 6))
        
        src_entry_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        src_entry_frame.pack(fill=tk.X, padx=20, pady=(0, 12))
        
        self.entry_src = tk.Entry(src_entry_frame, textvariable=self.source_dir, font=self.font_normal, bg=BG_COLOR, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, bd=0, highlightthickness=1, highlightbackground=BORDER_COLOR, highlightcolor=ACCENT_COLOR)
        self.entry_src.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, ipadx=5)
        
        btn_src = tk.Button(src_entry_frame, text="选择文件夹", font=self.font_bold, bg=ACCENT_COLOR, fg=BG_COLOR, activebackground="#74c7ec", activeforeground=BG_COLOR, bd=0, cursor="hand2", command=self.select_source, width=11)
        btn_src.pack(side=tk.RIGHT, padx=(12, 0), ipady=4)
        
        # 选择目标文件夹
        dest_lbl = tk.Label(main_frame, text="第二步：选择同名视频移动到的目标文件夹", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        dest_lbl.pack(anchor="w", padx=20, pady=(6, 6))
        
        dest_entry_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        dest_entry_frame.pack(fill=tk.X, padx=20, pady=(0, 18))
        
        self.entry_dest = tk.Entry(dest_entry_frame, textvariable=self.dest_dir, font=self.font_normal, bg=BG_COLOR, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, bd=0, highlightthickness=1, highlightbackground=BORDER_COLOR, highlightcolor=ACCENT_COLOR)
        self.entry_dest.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, ipadx=5)
        
        btn_dest = tk.Button(dest_entry_frame, text="选择文件夹", font=self.font_bold, bg=ACCENT_COLOR, fg=BG_COLOR, activebackground="#74c7ec", activeforeground=BG_COLOR, bd=0, cursor="hand2", command=self.select_dest, width=11)
        btn_dest.pack(side=tk.RIGHT, padx=(12, 0), ipady=4)
        
        # 日志及进度框
        log_lbl = tk.Label(main_frame, text="运行日志及处理进度", font=self.font_bold, bg=CARD_COLOR, fg=TEXT_COLOR)
        log_lbl.pack(anchor="w", padx=20, pady=(5, 6))
        
        log_frame = tk.Frame(main_frame, bg=BG_COLOR, bd=1, relief="flat", highlightbackground=BORDER_COLOR, highlightthickness=1)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 18))
        
        self.scrollbar = tk.Scrollbar(log_frame)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.log_text = tk.Text(log_frame, yscrollcommand=self.scrollbar.set, font=self.font_small, bg=BG_COLOR, fg=TEXT_MUTED, bd=0, highlightthickness=0, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)
        self.scrollbar.config(command=self.log_text.yview)
        
        self.log("系统就绪。请选择您的源文件夹与目标文件夹，然后点击下方按钮启动整理任务。")
        
        # 执行动作按钮
        btn_action_frame = tk.Frame(main_frame, bg=CARD_COLOR)
        btn_action_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        self.btn_run = tk.Button(btn_action_frame, text="🚀 启动整理：安全移动同名 MP4", font=self.font_bold, bg=SUCCESS_COLOR, fg=BG_COLOR, activebackground="#a6e3a1", activeforeground=BG_COLOR, bd=0, cursor="hand2", command=self.run_process, height=2)
        self.btn_run.pack(fill=tk.X)
        
    def select_source(self):
        folder = filedialog.askdirectory(title="选择源相册文件夹")
        if folder:
            folder = os.path.normpath(folder)
            self.source_dir.set(folder)
            self.log(f"已选源文件夹: {folder}")
            
    def select_dest(self):
        folder = filedialog.askdirectory(title="选择备份移动目标文件夹")
        if folder:
            folder = os.path.normpath(folder)
            self.dest_dir.set(folder)
            self.log(f"已选目标文件夹: {folder}")
            
    def log(self, message):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update_idletasks()
        
    def run_process(self):
        src = self.source_dir.get().strip()
        dest = self.dest_dir.get().strip()
        
        if not src or not os.path.exists(src):
            messagebox.showerror("错误", "请先选择有效的源相册文件夹！")
            return
        if not dest or not os.path.exists(dest):
            messagebox.showerror("错误", "请先选择有效的移动目标文件夹！")
            return
        if src == dest:
            messagebox.showerror("错误", "源文件夹与目标文件夹不能完全相同，请重新选择！")
            return
            
        self.btn_run.config(state=tk.DISABLED, bg=BORDER_COLOR, fg=TEXT_MUTED)
        self.log("\n=================== 开始扫描及整理程序 ===================")
        
        try:
            moved_count = 0
            scanned_count = 0
            
            # 使用 os.walk 递归遍历所有子文件夹
            for root_dir, dirs, files in os.walk(src):
                # 建立当前目录下所有文件的映射（忽略大小写，用于高效对齐）
                file_map = {f.lower(): f for f in files}
                
                for f in files:
                    base, ext = os.path.splitext(f)
                    ext_lower = ext.lower()
                    
                    # 识别 MP4 视频
                    if ext_lower == '.mp4':
                        scanned_count += 1
                        
                        # 查找同名的静态 JPG/JPEG 文件（大小写兼容）
                        possible_jpgs = [base + '.jpg', base + '.jpeg', base + '.JPG', base + '.JPEG']
                        has_companion_jpg = False
                        
                        for p_jpg in possible_jpgs:
                            if p_jpg.lower() in file_map:
                                has_companion_jpg = True
                                break
                        
                        if has_companion_jpg:
                            # 存在同名 JPG 文件，符合移动条件
                            src_file_path = os.path.join(root_dir, f)
                            
                            # 保持目录结构，计算子文件夹的相对路径
                            rel_path = os.path.relpath(root_dir, src)
                            target_dir = os.path.join(dest, rel_path)
                            
                            if not os.path.exists(target_dir):
                                os.makedirs(target_dir)
                                
                            dest_file_path = os.path.join(target_dir, f)
                            
                            # 若目标文件夹已有同名文件，自动进行重命名编号，防止意外覆盖
                            if os.path.exists(dest_file_path):
                                base_name, ext_name = os.path.splitext(f)
                                counter = 1
                                while True:
                                    new_f = f"{base_name}_{counter}{ext_name}"
                                    dest_file_path = os.path.join(target_dir, new_f)
                                    if not os.path.exists(dest_file_path):
                                        break
                                    counter += 1
                            
                            shutil.move(src_file_path, dest_file_path)
                            moved_count += 1
                            
                            # 打印精炼的日志，显示相对路径，避免刷屏
                            rel_src_show = os.path.relpath(src_file_path, src)
                            self.log(f"[已移动] {rel_src_show} -> 目标文件夹")
            
            self.log("=================== 任务执行完成 ===================")
            self.log(f"▶ 累计扫描的 MP4 视频总数: {scanned_count}")
            self.log(f"▶ 成功移出的同名 MP4 视频数: {moved_count}")
            self.log(f"▶ 源文件夹现仅留存：静态图、内嵌视频的动态 JPG、独立 MP4 视频。")
            
            messagebox.showinfo("整理成功", f"恭喜，相册整理成功！\n\n共扫描了 {scanned_count} 个视频，已安全移出 {moved_count} 个同名视频。")
            
        except Exception as e:
            self.log(f"【运行中产生异常错误】: {str(e)}")
            messagebox.showerror("运行错误", f"在执行移动操作时发生异常中断:\n{str(e)}")
            
        finally:
            self.btn_run.config(state=tk.NORMAL, bg=SUCCESS_COLOR, fg=BG_COLOR)

if __name__ == "__main__":
    root = tk.Tk()
    app = FileMoverApp(root)
    root.mainloop()
