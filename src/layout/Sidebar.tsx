import {
  ImagePlus,
  Images,
  ScanLine,
  Shirt,
  Sparkles,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { GenerationTask } from "../features/tasks/types";
import styles from "./AppShell.module.css";

interface SidebarProps { tasks: GenerationTask[]; }

const tools = [
  { to: "/text-to-image", label: "批量文生图", icon: ImagePlus },
  { to: "/image-to-image", label: "批量图生图", icon: Images },
  { to: "/ai-retouch", label: "批量AI修图", icon: ScanLine },
  { to: "/outfit-swap", label: "批量模特换装", icon: Shirt },
];

const modeNames: Record<GenerationTask["mode"], string> = {
  "text-to-image": "批量文生图",
  "image-to-image": "批量图生图",
  "ai-retouch": "批量AI修图",
  "outfit-swap": "批量模特换装",
};

/**
 * 左侧业务导航和历史任务列表。
 *
 * @param props.tasks 当前可用的历史任务。
 * @returns 侧边导航区域。
 */
export function Sidebar({ tasks }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.toolNav} aria-label="作图工具">
        {tools.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.activeTool : ""}>
            <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.runningState}>
        <Sparkles size={16} /><span>暂无生成任务</span>
      </div>

      <section className={styles.historyNav}>
        <div className={styles.sectionLabel}>历史生成记录</div>
        <div className={styles.historyList}>
          {tasks.slice(0, 16).map((task) => (
            <NavLink key={task.id} to={`/history/${task.id}`}>
              <span>{modeNames[task.mode]}</span>
              <time>{new Date(task.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</time>
            </NavLink>
          ))}
        </div>
      </section>
    </aside>
  );
}
