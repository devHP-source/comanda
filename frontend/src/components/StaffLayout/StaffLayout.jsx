import { Outlet } from 'react-router'
import styles from './StaffLayout.module.css'

const StaffLayout = () => ( // Each staff screen draws its own header (waiter greeting, kitchen counters);
  <div className={styles.shell}>
    <Outlet />
  </div>
)

export default StaffLayout
