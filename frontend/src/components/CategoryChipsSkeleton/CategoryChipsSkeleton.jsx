import Skeleton from '../Skeleton/Skeleton.jsx'
import realStyles from '../CategoryChips/CategoryChips.module.css' // the real component's classes: same sizes at every breakpoint

const WIDTHS = ['5.8rem', '5rem', '6.5rem', '4.5rem']
const ITEMS = 12 // enough to fill a tablet's width

const CategoryChipsSkeleton = () => (
  <div className={realStyles.bar}>
    <div className={`${realStyles.strip} hide-scrollbar`}>
      {Array.from({ length: ITEMS }, (_, index) => (
        <div key={index}>
          <Skeleton width={WIDTHS[index % WIDTHS.length]} height="var(--tap-min)" radius="var(--radius-pill)" />
        </div>
      ))}
    </div>
  </div>
)

export default CategoryChipsSkeleton
