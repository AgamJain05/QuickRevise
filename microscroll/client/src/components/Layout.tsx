import { Outlet, NavLink, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/explore', icon: 'explore', label: 'Explore' },
  { path: '/create', icon: 'add', label: 'Create', isMain: true },
  { path: '/library', icon: 'collections_bookmark', label: 'Library' },
  { path: '/profile', icon: 'person', label: 'You' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="relative flex min-h-dvh w-full flex-col mx-auto max-w-md bg-background-light shadow-2xl">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-lg border-t border-slate-100 safe-area-bottom z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            
            if (item.isMain) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="relative -mt-6"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow btn-press transition-all hover:bg-primary-dark">
                    <span className="material-symbols-outlined text-white text-[28px]">
                      {item.icon}
                    </span>
                  </div>
                </NavLink>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'material-symbols-filled' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
