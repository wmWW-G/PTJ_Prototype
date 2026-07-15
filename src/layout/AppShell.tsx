import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { listTasks, TASKS_UPDATED_EVENT } from "../features/tasks/taskRepository";
import type { GenerationTask } from "../features/tasks/types";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** 应用共用外壳，负责在任务变更后同步刷新左侧历史列表。 */
export function AppShell() {
  const [tasks, setTasks] = useState<GenerationTask[]>(() => listTasks());

  useEffect(() => {
    const refreshTasks = () => setTasks(listTasks());
    window.addEventListener(TASKS_UPDATED_EVENT, refreshTasks);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, refreshTasks);
  }, []);

  return (
    <div className={styles.shell}>
      <TopBar />
      <Sidebar tasks={tasks} />
      <main className={styles.main}><Outlet /></main>
    </div>
  );
}
