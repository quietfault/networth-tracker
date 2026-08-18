import lockupDark from '../assets/brand/lockup--dark.svg'
import lockupLight from '../assets/brand/lockup--light.svg'
import markDark from '../assets/brand/mark--dark.svg'
import markLight from '../assets/brand/mark--light.svg'

// Лого-блок берётся готовым файлом: пропорции, трекинг и приглушённая
// первая половина слова зашиты в SVG, собирать его руками запрещено.
// Вариант под тему выбирается CSS, а не JS, чтобы знак не мигал при
// переключении. --mono не годится: currentColor через <img> не наследуется.
export function Logo({ withMark = false }: { withMark?: boolean }) {
  return (
    <>
      <img src={lockupDark} alt="quietfault" className="brand-lockup on-dark" />
      <img src={lockupLight} alt="quietfault" className="brand-lockup on-light" />
      {withMark && (
        <>
          <img src={markDark} alt="quietfault" className="brand-mark on-dark" />
          <img src={markLight} alt="quietfault" className="brand-mark on-light" />
        </>
      )}
    </>
  )
}
