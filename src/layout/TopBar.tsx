import { BookOpen, CircleUserRound, Coins, CreditCard, Home, Image } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import styles from "./AppShell.module.css";

/** 顶部工具栏，使用演示余额和演示账户，避免携带真实用户信息。 */
export function TopBar() {
  return (
    <header className={styles.topbar}>
      <BrandMark />
      <nav className={styles.topnav} aria-label="顶部导航">
        <Link to="/text-to-image"><Home size={17} />首页</Link>
        <button type="button"><BookOpen size={17} />使用教程</button>
        <button type="button"><CreditCard size={17} />充值中心</button>
      </nav>
      <div className={styles.accountStrip}>
        <span><Coins size={17} /> 9,999 金豆</span>
        <span><Image size={17} /> 9,999 张图</span>
        <span className={styles.demoAccount}><CircleUserRound size={20} /> 演示账号</span>
      </div>
    </header>
  );
}
