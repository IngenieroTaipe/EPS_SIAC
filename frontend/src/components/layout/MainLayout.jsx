import Sidebar from "./Sidebar"

export default function MainLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-100 w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}