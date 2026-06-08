export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

export const heroEntry = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: 'easeOut' as const },
}

export const stagger = {
  whileInView: { transition: { staggerChildren: 0.06 } },
  viewport: { once: true },
}

export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.4, ease: 'easeOut' as const },
}

export const btnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
}

export const modalEntry = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
}
