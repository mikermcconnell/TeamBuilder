export function shouldRenderSubLotteryApp(pathname: string, appVariant: string | undefined): boolean {
  return appVariant === 'subs' || pathname === '/sub-lottery' || pathname.startsWith('/sub-lottery/')
}
