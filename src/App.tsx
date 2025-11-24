import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { app } from './firebase'
import { getDatabase, onValue, push, ref, remove, set, update } from 'firebase/database'
import loadingGif from './assets/laoding.gif'

type Role = 'admin' | 'waiter'

type User = {
  id: string
  name: string
  role: Role
  phone: string
  pin: string
}

type Item = {
  id: string
  name: string
  price: number
}

type OrderItem = {
  itemId: string
  qty: number
}

type Order = {
  id: string
  waiterId: string
  time: string
  items: OrderItem[]
  status?: 'paid' | 'loan'
}

type Banner = { type: 'success' | 'error'; message: string } | null

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('25290')) return digits.slice(5)
  if (digits.startsWith('2520')) return digits.slice(4)
  if (digits.startsWith('252')) return digits.slice(3)
  if (digits.startsWith('0')) return digits.slice(1)
  return digits
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function App() {
  const db = useMemo(() => getDatabase(app), [])
  const dbPath = (path: string) => ref(db, `rms/${path}`)
  const [users, setUsers] = useState<User[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [draftWaiter, setDraftWaiter] = useState<string>('')
  const [draftQty, setDraftQty] = useState<Record<string, number>>({})
  const [banner, setBanner] = useState<Banner>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authPhone, setAuthPhone] = useState<string>('')
  const [authPin, setAuthPin] = useState<string>('')
  const [authError, setAuthError] = useState<string>('')
  const [tab, setTab] = useState<'dash' | 'orders' | 'staff' | 'items' | 'reports'>('dash')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [waiterSearch, setWaiterSearch] = useState('')
  const [newWaiterName, setNewWaiterName] = useState('')
  const [newWaiterPhone, setNewWaiterPhone] = useState('')
  const [waiterModalOpen, setWaiterModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [actionWaiter, setActionWaiter] = useState<User | null>(null)
  const [actionType, setActionType] = useState<'reset' | 'profile' | null>(null)
  const [actionName, setActionName] = useState('')
  const [actionPhone, setActionPhone] = useState('')
  const [itemManageSearch, setItemManageSearch] = useState('')
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('0')
  const [openItemAction, setOpenItemAction] = useState<string | null>(null)
  const [itemActionItem, setItemActionItem] = useState<Item | null>(null)
  const [itemActionName, setItemActionName] = useState('')
  const [itemActionPrice, setItemActionPrice] = useState('0')
  const [pendingItemDelete, setPendingItemDelete] = useState<Item | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reportTab, setReportTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')

  const itemsById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items])
  const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users])
  const formatPrice = (value: number) => `$${value.toFixed(2)}`

  const metrics = useMemo(() => {
    const scopedOrders =
      currentUser && currentUser.role === 'waiter'
        ? orders.filter((o) => o.waiterId === currentUser.id)
        : orders
    const totalOrders = scopedOrders.length
    const totalItems = scopedOrders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.qty, 0), 0)
    const totalSales = scopedOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (s, entry) => s + entry.qty * (itemsById[entry.itemId]?.price ?? 0),
          0
        ),
      0
    )
    const lowStock: Item[] = []
    const busiestWaiter = scopedOrders.reduce<Record<string, number>>((acc, order) => {
      acc[order.waiterId] = (acc[order.waiterId] ?? 0) + 1
      return acc
    }, {})
    const topWaiterId =
      Object.entries(busiestWaiter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    return { totalOrders, totalItems, lowStock, topWaiterId, totalSales }
  }, [orders, items, currentUser, itemsById])

  const orderTotal = (order: Order) =>
    order.items.reduce((sum, entry) => sum + entry.qty * (itemsById[entry.itemId]?.price ?? 0), 0)
  const draftTotal = Object.entries(draftQty).reduce(
    (sum, [itemId, qty]) => sum + qty * (itemsById[itemId]?.price ?? 0),
    0
  )
  const scopedOrders =
    currentUser && currentUser.role === 'waiter'
      ? orders.filter((o) => o.waiterId === currentUser.id)
      : orders
  const ordersFiltered = scopedOrders.filter((order) => {
    const text = `${order.id} ${usersById[order.waiterId]?.name ?? ''}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
  })
  const getWeekId = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${date.getUTCFullYear()}-W${weekNo}`
  }

  const reportRows = useMemo(() => {
    const start = reportStart ? new Date(reportStart) : null
    const end = reportEnd ? new Date(reportEnd) : null
    if (end) end.setHours(23, 59, 59, 999)

    const filteredOrders = orders.filter((o) => {
      const t = new Date(o.time).getTime()
      if (start && t < start.getTime()) return false
      if (end && t > end.getTime()) return false
      return true
    })

    const buckets = new Map<string, { ordersCount: number; itemsCount: number; sales: number; paid: number; loan: number }>()
    filteredOrders.forEach((order) => {
      const date = new Date(order.time)
      let key = ''
      if (reportTab === 'daily') key = date.toISOString().slice(0, 10)
      if (reportTab === 'weekly') key = getWeekId(date)
      if (reportTab === 'monthly') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (reportTab === 'yearly') key = `${date.getFullYear()}`
      const current = buckets.get(key) ?? { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0 }
      current.ordersCount += 1
      current.itemsCount += order.items.reduce((s, i) => s + i.qty, 0)
      current.sales += order.items.reduce((s, i) => s + i.qty * (itemsById[i.itemId]?.price ?? 0), 0)
      if (order.status === 'loan') current.loan += 1
      else current.paid += 1
      buckets.set(key, current)
    })

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([label, stats]) => ({ label, ...stats }))
  }, [orders, itemsById, reportStart, reportEnd, reportTab])
  const waitersFiltered = users
    .filter((u) => u.role === 'waiter')
    .filter((u) => {
      const text = `${u.name} ${u.phone}`.toLowerCase()
      return text.includes(waiterSearch.trim().toLowerCase())
    })

  const itemsFiltered = items.filter((item) =>
    item.name.toLowerCase().includes(itemManageSearch.trim().toLowerCase())
  )

  const exportReportCSV = () => {
    const header = ['Period', 'Orders', 'Items', 'Sales', 'Paid', 'Loan']
    const rows = reportRows.map((r) => [r.label, r.ordersCount, r.itemsCount, r.sales.toFixed(2), r.paid, r.loan])
    const total = reportRows.reduce(
      (acc, r) => ({
        ordersCount: acc.ordersCount + r.ordersCount,
        itemsCount: acc.itemsCount + r.itemsCount,
        sales: acc.sales + r.sales,
        paid: acc.paid + r.paid,
        loan: acc.loan + r.loan,
      }),
      { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0 }
    )
    rows.push(['Total', total.ordersCount, total.itemsCount, total.sales.toFixed(2), total.paid, total.loan])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reports.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const printReport = () => {
    const win = window.open('', 'PRINT', 'height=600,width=800')
    if (!win) return
    const tableRows = reportRows
      .map(
        (r) =>
          `<tr><td>${r.label}</td><td>${r.ordersCount}</td><td>${r.itemsCount}</td><td>$${r.sales.toFixed(
            2
          )}</td><td>${r.paid}</td><td>${r.loan}</td></tr>`
      )
      .join('')
    const total = reportRows.reduce(
      (acc, r) => ({
        ordersCount: acc.ordersCount + r.ordersCount,
        itemsCount: acc.itemsCount + r.itemsCount,
        sales: acc.sales + r.sales,
        paid: acc.paid + r.paid,
        loan: acc.loan + r.loan,
      }),
      { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0 }
    )
    const html = `
      <html>
      <head><title>Reports</title></head>
      <body>
        <h2>Reports</h2>
        <table border="1" cellspacing="0" cellpadding="6">
          <tr><th>Period</th><th>Orders</th><th>Items</th><th>Sales</th><th>Paid</th><th>Loan</th></tr>
          ${tableRows}
          <tr><td><strong>Total</strong></td><td>${total.ordersCount}</td><td>${total.itemsCount}</td><td>$${total.sales.toFixed(
            2
          )}</td><td>${total.paid}</td><td>${total.loan}</td></tr>
        </table>
      </body>
      </html>
    `
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const closeOverlays = () => {
    setWaiterModalOpen(false)
    setPendingDelete(null)
    setOpenAction(null)
    setActionWaiter(null)
    setActionType(null)
    setItemModalOpen(false)
    setPendingItemDelete(null)
    setItemActionItem(null)
    setOpenItemAction(null)
  }

  useEffect(() => {
    const unsubUsers = onValue(dbPath('users'), (snap) => {
      const val = snap.val() as Record<string, User> | null
      const list: User[] = val
        ? Object.entries(val).map(([id, user]) => ({ id, ...(user as Omit<User, 'id'>) }))
        : []
      setUsers(list)

      if (!draftWaiter) {
        const firstWaiter = list.find((u) => u.role === 'waiter')
        if (firstWaiter) setDraftWaiter(firstWaiter.id)
      }
      if (currentUser && !list.find((u) => u.id === currentUser.id)) {
        setCurrentUser(null)
      }
    })

    const unsubItems = onValue(dbPath('items'), (snap) => {
    const val = snap.val() as Record<string, Item> | null
    const list: Item[] = val
      ? Object.entries(val).map(([id, item]) => ({
          id,
          name: item.name,
          price: item.price ?? 0,
        }))
      : []
    setItems(list)
  })

    const unsubOrders = onValue(dbPath('orders'), (snap) => {
      const val = snap.val() as Record<string, any> | null
      const list: Order[] = val
        ? Object.entries(val).map(([id, order]) => ({
            id: order.id ?? id,
            waiterId: order.waiterId ?? order.waiter_id,
            time: order.time,
            status: order.status ?? 'paid',
            items: Array.isArray(order.items)
              ? order.items
              : Object.entries(order.items ?? {}).map(([itemId, record]: any) => ({
                  itemId,
                  qty: record.qty ?? 0,
                })),
          }))
        : []
      setOrders(list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()))
      setIsLoading(false)
    })

    return () => {
      unsubUsers()
      unsubItems()
      unsubOrders()
    }
  }, [db, currentUser])

  const updateDraftQty = (itemId: string, qty: number) => {
    setDraftQty((prev) => {
      const next = { ...prev }
      if (qty <= 0) {
        delete next[itemId]
      } else {
        next[itemId] = qty
      }
      return next
    })
  }

  const handleCreateOrder = () => {
    setBanner(null)
    const selected = Object.entries(draftQty)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }))

    if (!draftWaiter) {
      setBanner({ type: 'error', message: 'Pick a waiter to assign the order.' })
      return
    }
    if (selected.length === 0) {
      setBanner({ type: 'error', message: 'Add at least one item before submitting.' })
      return
    }

    const orderRef = push(dbPath('orders'))
    const orderId = orderRef.key ?? `order-${Date.now()}`
    const itemsMap: Record<string, { qty: number }> = {}
    selected.forEach((s) => {
      itemsMap[s.itemId] = { qty: s.qty }
    })
    const payload = {
      id: orderId,
      waiter_id: draftWaiter,
      time: new Date().toISOString(),
      status: 'paid',
      items: itemsMap,
    }

    set(orderRef, payload)
      .then(() => {
        setDraftQty({})
        setShowOrderModal(false)
        setBanner({ type: 'success', message: 'Order captured and stock updated.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const addWaiter = () => {
    setBanner(null)
    if (!newWaiterName.trim() || !newWaiterPhone.trim()) {
      setBanner({ type: 'error', message: 'Fill name and phone for the new waiter.' })
      return
    }
    const pin = '4321'
    const id = `waiter-${Date.now()}`
    const newUser: User = {
      id,
      name: newWaiterName.trim(),
      phone: newWaiterPhone.trim(),
      pin,
      role: 'waiter',
    }
    push(dbPath('users'), newUser)
      .then(() => {
        setNewWaiterName('')
        setNewWaiterPhone('')
        setWaiterModalOpen(false)
        setBanner({ type: 'success', message: 'Waiter added.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const addItem = () => {
    setBanner(null)
    if (!newItemName.trim()) {
      setBanner({ type: 'error', message: 'Provide an item name.' })
      return
    }
    const price = Number(newItemPrice)
    if (Number.isNaN(price) || price <= 0) {
      setBanner({ type: 'error', message: 'Provide a valid price above 0.' })
      return
    }
    const newItem = { name: newItemName.trim(), price }
    push(dbPath('items'), newItem)
      .then(() => {
        setNewItemName('')
        setNewItemPrice('0')
        setItemModalOpen(false)
        setBanner({ type: 'success', message: 'Item added.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateItem = () => {
    if (!itemActionItem) return
    const name = itemActionName.trim()
    const price = Number(itemActionPrice)
    if (!name) {
      setBanner({ type: 'error', message: 'Provide an item name.' })
      return
    }
    if (Number.isNaN(price) || price <= 0) {
      setBanner({ type: 'error', message: 'Provide a valid price above 0.' })
      return
    }
    update(dbPath(`items/${itemActionItem.id}`), { name, price })
      .then(() => {
        setItemActionItem(null)
        setOpenItemAction(null)
        setBanner({ type: 'success', message: 'Item updated.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const deleteItem = (id: string) => {
    remove(dbPath(`items/${id}`))
      .then(() => setBanner({ type: 'success', message: 'Item removed.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const resetWaiterPin = (id: string) => {
    update(dbPath(`users/${id}`), { pin: '0000' })
      .then(() => setBanner({ type: 'success', message: 'PIN reset to 0000.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateWaiterProfile = (id: string, name: string, phone: string) => {
    const nextName = name.trim()
    const nextPhone = phone.trim()
    if (!nextName || !nextPhone) {
      setBanner({ type: 'error', message: 'Provide both name and phone.' })
      return
    }
    update(dbPath(`users/${id}`), { name: nextName, phone: nextPhone })
      .then(() => setBanner({ type: 'success', message: 'Waiter updated.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const deleteWaiter = (id: string) => {
    if (currentUser?.id === id) {
      setBanner({ type: 'error', message: 'Cannot delete the signed-in user.' })
      return
    }
    remove(dbPath(`users/${id}`))
      .then(() => setBanner({ type: 'success', message: 'Waiter removed.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateOrderStatus = (id: string, status: 'paid' | 'loan') => {
    update(dbPath(`orders/${id}`), { status })
      .then(() => setBanner({ type: 'success', message: 'Order status updated.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const handleLogin = () => {
    if (users.length === 0) {
      setAuthError('Data is still loading. Try again in a moment.')
      return
    }

    const phone = authPhone.trim()
    const normalized = normalizePhone(phone)
    const pin = authPin.trim()
    const match = users.find((user) => {
      if (user.pin !== pin) return false
      const stored = normalizePhone(user.phone)
      return (
        user.phone === phone ||
        stored === normalized ||
        stored.endsWith(normalized) ||
        normalized.endsWith(stored)
      )
    })

    if (!match) {
      setAuthError('Invalid phone or PIN. Try again.')
      return
    }

    setAuthError('')
    setCurrentUser(match)
    setTab('dash')
    setSidebarOpen(false)
    setProfileOpen(false)
    setBanner({ type: 'success', message: `Welcome, ${match.name}!` })
    if (match.role === 'waiter') {
      setDraftWaiter(match.id)
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setBanner(null)
    setDraftWaiter('')
    setProfileOpen(false)
  }

  if (!currentUser) {
    if (isLoading) {
      return (
        <div className="loader-page">
          <img src={loadingGif} alt="Loading" className="loader__gif" />
        </div>
      )
    }
    const shellClass = 'mobile-shell auth-shell'
    return (
      <div className={shellClass}>
        <div className="auth">
          <div className="auth__card">
            <div className="chef-icon" aria-hidden />
            <h1 className="auth__title">RestoDash Login</h1>
            <p className="auth__hint">Access your management panel.</p>
            <div className="auth__form">
              <label className="field">
                <span>Phone Number</span>
                <input
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="e.g., +252907273303"
                />
              </label>
              <label className="field">
                <span>PIN (4 digits)</span>
                <input
                  type="password"
                  value={authPin}
                  onChange={(e) => setAuthPin(e.target.value)}
                  placeholder="****"
                />
              </label>
              {authError && <div className="banner banner--error">{authError}</div>}
              <button className="primary auth__btn" onClick={handleLogin}>
                <span className="auth__btn-icon" aria-hidden>
                  ↘
                </span>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isAdmin = currentUser.role === 'admin'
  const shellClass = `mobile-shell${isAdmin ? ' admin-shell' : ''}`

  return (
    <div className={`${shellClass} ${isAdmin && sidebarOpen ? 'sidebar-open' : ''}`}>
      {isAdmin && <div className="overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`layout-shell ${isAdmin ? 'with-sidebar' : ''}`}>
        {isAdmin && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar__brand">
              <span role="img" aria-label="chef">
                👨‍🍳
              </span>
              <span>RestoDash</span>
              <button className="icon-btn sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                ✕
              </button>
            </div>
            <nav className="sidebar__nav">
              <button className="sidebar__item" onClick={() => { setTab('dash'); setSidebarOpen(false) }}>
                🏠 <span>Dashboard</span>
              </button>
              <button className="sidebar__item" onClick={() => { setTab('orders'); setSidebarOpen(false) }}>
                🧾 <span>Orders</span>
              </button>
              <button className="sidebar__item" onClick={() => { setTab('staff'); setSidebarOpen(false) }}>
                🧑‍🍳 <span>Waiters</span>
              </button>
              <button className="sidebar__item" onClick={() => { setTab('items'); setSidebarOpen(false) }}>
                🍱 <span>Order Items</span>
              </button>
              <button className="sidebar__item" onClick={() => { setTab('reports'); setSidebarOpen(false) }}>
                📈 <span>Reports</span>
              </button>
            </nav>
          </aside>
        )}

        <div className="main-column">
          <header className="topbar">
            {isAdmin ? (
              <div className="topbar__left">
                <button className="icon-btn ghost-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">
                  ☰
                </button>
                <div className="brand">RestoDash</div>
              </div>
            ) : (
              <div className="brand">RestoDash</div>
            )}
            <div className="topbar__user">
              <div className="topbar__meta">
                <strong>{currentUser.name}</strong>
                <span>{currentUser.role === 'waiter' ? 'Waiter' : 'Admin'}</span>
              </div>
              <button className="avatar" onClick={() => setProfileOpen((v) => !v)} aria-label="Profile menu">
                {currentUser.name.charAt(0)}
              </button>
              {profileOpen && (
                <div className="profile-card">
                  <p className="profile-name">{currentUser.name}</p>
                  <p className="profile-meta">{currentUser.phone}</p>
                  <p className="profile-meta">{currentUser.role}</p>
                  <button className="signout-btn block" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </header>

          <main className="content">
            {tab === 'dash' && (
              <>
                <div className="page-title-row">
                  <div>
                    <p className="eyebrow">Overview</p>
                    <h1 className="page-title">My Dashboard</h1>
                  </div>
                </div>
                {banner && <div className={`banner banner--${banner.type}`}>{banner.message}</div>}
                <div className="card-grid">
                  <div className="metric-card gradient">
                    <p>My Sales</p>
                    <strong>{formatPrice(metrics.totalSales)}</strong>
                    <span className="metric-icon">$</span>
                  </div>
                  <div className="metric-card gradient">
                    <p>My Active Orders</p>
                    <strong>{metrics.totalOrders}</strong>
                    <span className="metric-icon">≡</span>
                  </div>
                </div>
              </>
            )}

            {tab === 'orders' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">Orders</h1>
                  </div>
                </div>
                <input
                  className="search"
                  type="search"
                  placeholder="Search by Order ID (last 4 digits) or Waiter Name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="order-list-card">
                  {ordersFiltered.length === 0 && <div className="empty light">No active orders found.</div>}
                  {ordersFiltered.map((order) => (
                    <div key={order.id} className="order-card light">
                      <div className="order-card__row">
                        <div>
                          <p className="order-id">{order.id}</p>
                          <p className="order-meta">Served by: {usersById[order.waiterId]?.name ?? order.waiterId}</p>
                        </div>
                        <div className="order-amount">
                          {formatPrice(orderTotal(order))}
                          <select
                            className="status-select"
                            value={order.status === 'loan' ? 'loan' : 'paid'}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value as 'paid' | 'loan')}
                          >
                            <option value="paid">Paid</option>
                            <option value="loan">Loan</option>
                          </select>
                        </div>
                      </div>
                      <div className="order-card__meta">
                        <span className="icon">🧾</span>
                        <span className="order-time">{formatDateTime(order.time)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'staff' && currentUser.role === 'admin' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">Waiters</h1>
                  </div>
                </div>
                <div className="panel light staff-form">
                  <div className="toolbar">
                    <input
                      className="search"
                      placeholder="Search waiter by name or phone"
                      value={waiterSearch}
                      onChange={(e) => setWaiterSearch(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={() => {
                        closeOverlays()
                        setWaiterModalOpen(true)
                      }}
                    >
                      + Add waiter
                    </button>
                  </div>
                  <div className="table">
                    <div className="table__head">
                      <span>No.</span>
                      <span>Name</span>
                      <span>Phone</span>
                      <span>Actions</span>
                    </div>
                    {waitersFiltered.length === 0 && <div className="empty light">No waiters found.</div>}
                    {waitersFiltered.map((waiter, idx) => (
                      <div key={waiter.id} className="table__row">
                        <span>{idx + 1}.</span>
                        <span>{waiter.name}</span>
                        <span>{waiter.phone}</span>
                        <div className="action-menu">
                          <button
                            className="action-dots"
                            onClick={() => {
                              setPendingDelete(null)
                              setActionWaiter(null)
                              setActionType(null)
                              setOpenAction((prev) => (prev === waiter.id ? null : waiter.id))
                            }}
                            aria-haspopup="menu"
                          >
                            ⋮
                          </button>
                          {openAction === waiter.id && (
                            <div className="action-menu__dropdown">
                              <button
                                className="pill-btn"
                                onClick={() => {
                                  setPendingDelete(null)
                                  setActionWaiter(waiter)
                                  setActionType('profile')
                                  setActionName(waiter.name)
                                  setActionPhone(waiter.phone)
                                  setOpenAction(null)
                                }}
                              >
                                Update
                              </button>
                              <button
                                className="pill-btn warn"
                                onClick={() => {
                                  setPendingDelete(null)
                                  setActionWaiter(waiter)
                                  setActionType('reset')
                                  setOpenAction(null)
                                }}
                              >
                                Reset PIN
                              </button>
                              <button
                                className="pill-btn danger"
                                onClick={() => {
                                  setActionWaiter(null)
                                  setActionType(null)
                                  setOpenAction(null)
                                  setPendingDelete(waiter)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'items' && currentUser.role === 'admin' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">Items</h1>
                  </div>
                </div>
                <div className="panel light staff-form">
                  <div className="toolbar">
                    <input
                      className="search"
                      placeholder="Search items"
                      value={itemManageSearch}
                      onChange={(e) => setItemManageSearch(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={() => {
                        closeOverlays()
                        setItemModalOpen(true)
                      }}
                    >
                      + Add item
                    </button>
                  </div>
                  <div className="table">
                    <div className="table__head">
                      <span>No.</span>
                      <span>Name</span>
                      <span>Price</span>
                      <span>Actions</span>
                    </div>
                    {itemsFiltered.length === 0 && <div className="empty light">No items found.</div>}
                    {itemsFiltered.map((item, idx) => (
                      <div key={item.id} className="table__row">
                        <span>{idx + 1}.</span>
                        <span>{item.name}</span>
                        <span>{formatPrice(item.price)}</span>
                        <div className="action-menu">
                          <button
                            className="action-dots"
                            onClick={() => {
                              setOpenItemAction((prev) => (prev === item.id ? null : item.id))
                              setItemActionItem(item)
                              setItemActionName(item.name)
                              setItemActionPrice(String(item.price))
                              setPendingItemDelete(null)
                            }}
                            aria-haspopup="menu"
                          >
                            ⋮
                          </button>
                          {openItemAction === item.id && (
                            <div className="action-menu__dropdown">
                              <button
                                className="pill-btn"
                                onClick={() => {
                                  setItemActionItem(item)
                                  setOpenItemAction(null)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="pill-btn danger"
                                onClick={() => {
                                  setPendingItemDelete(item)
                                  setOpenItemAction(null)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'reports' && currentUser.role === 'admin' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">Reports</h1>
                  </div>
                </div>
                <div className="report-tabs">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      className={`pill-btn ${reportTab === tabKey ? 'active' : ''}`}
                      onClick={() => setReportTab(tabKey)}
                    >
                      {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="report-actions">
                  <div className="date-filters">
                    <input
                      type="date"
                      value={reportStart}
                      onChange={(e) => setReportStart(e.target.value)}
                    />
                    <input
                      type="date"
                      value={reportEnd}
                      onChange={(e) => setReportEnd(e.target.value)}
                    />
                  </div>
                  <div className="export-btns">
                    <button className="pill-btn" onClick={printReport}>
                      Print / PDF
                    </button>
                    <button className="pill-btn" onClick={exportReportCSV}>
                      Excel (CSV)
                    </button>
                  </div>
                </div>
                <div className="panel light">
                  <div className="table reports-table">
                    <div className="table__head">
                      <span>Period</span>
                      <span>Orders</span>
                      <span>Items</span>
                      <span>Sales</span>
                      <span>Paid</span>
                      <span>Loan</span>
                    </div>
                    {reportRows.map((row) => (
                      <div key={row.label} className="table__row">
                        <span>{row.label}</span>
                        <span>{row.ordersCount}</span>
                        <span>{row.itemsCount}</span>
                        <span>{formatPrice(row.sales)}</span>
                        <span>{row.paid}</span>
                        <span>{row.loan}</span>
                      </div>
                    ))}
                    <div className="table__row total-row">
                      <span>Total</span>
                      <span>{reportRows.reduce((s, r) => s + r.ordersCount, 0)}</span>
                      <span>{reportRows.reduce((s, r) => s + r.itemsCount, 0)}</span>
                      <span>
                        {formatPrice(reportRows.reduce((s, r) => s + r.sales, 0))}
                      </span>
                      <span>{reportRows.reduce((s, r) => s + r.paid, 0)}</span>
                      <span>{reportRows.reduce((s, r) => s + r.loan, 0)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {!isAdmin && (
        <button className="fab" onClick={() => setShowOrderModal(true)} aria-label="Add order">
          +
        </button>
      )}

      {!isAdmin && (
        <nav className="tabbar">
          <button className={`tabbar__btn ${tab === 'dash' ? 'active' : ''}`} onClick={() => setTab('dash')}>
            🏠
            <span>Dash</span>
          </button>
          <button className={`tabbar__btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
            📋
            <span>Orders</span>
          </button>
          {currentUser.role === 'admin' && (
            <button className={`tabbar__btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>
              📊
              <span>Staff</span>
            </button>
          )}
        </nav>
      )}

      {showOrderModal && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>New Order</h3>
              <button className="icon-btn" onClick={() => setShowOrderModal(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <input
              className="search"
              type="search"
              placeholder="Search menu items..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
            <div className="modal__items">
              {items
                .filter((item) => item.name.toLowerCase().includes(itemSearch.trim().toLowerCase()))
                .map((item) => {
                  const qty = draftQty[item.id] ?? 0
                  return (
                    <div key={item.id} className="item-row">
                      <div>
                        <p className="item-name">{item.name}</p>
                        <p className="item-meta">{formatPrice(item.price)}</p>
                      </div>
                      <div className="qty-changer">
                        <button
                          className="qty-btn"
                          onClick={() => updateDraftQty(item.id, Math.max(0, qty - 1))}
                        >
                          −
                        </button>
                        <span className="qty">{qty}</span>
                        <button className="qty-btn plus" onClick={() => updateDraftQty(item.id, qty + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="modal__total">
              <span>Total:</span>
              <strong>{formatPrice(draftTotal)}</strong>
            </div>
            <button className="primary block" onClick={handleCreateOrder}>
              📋 Submit Order
            </button>
          </div>
        </div>
      )}

      {waiterModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Add Waiter</h3>
              <button className="icon-btn" onClick={() => setWaiterModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal__items">
              <input
                className="field-input"
                placeholder="Waiter name"
                value={newWaiterName}
                onChange={(e) => setNewWaiterName(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Phone"
                value={newWaiterPhone}
                onChange={(e) => setNewWaiterPhone(e.target.value)}
              />
            </div>
            <p className="order-meta">Default PIN: 4321</p>
            <button className="primary block" onClick={addWaiter}>
              Add waiter
            </button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Confirm delete</h3>
            </div>
            <p className="order-meta">
              Are you sure you want to delete <strong>{pendingDelete.name}</strong>?
            </p>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                className="pill-btn danger"
                onClick={() => {
                  deleteWaiter(pendingDelete.id)
                  setPendingDelete(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {itemModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Add Item</h3>
              <button className="icon-btn" onClick={() => setItemModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
              <p className="order-meta">Set the item name and price.</p>
            <div className="modal__items">
              <label className="field">
                <span>Item name</span>
                <input
                  className="field-input"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Price</span>
                <input
                  className="field-input"
                  placeholder="Price"
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
              </label>
            </div>
            <button className="primary block" onClick={addItem}>
              Add item
            </button>
          </div>
        </div>
      )}

      {itemActionItem && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Edit Item</h3>
              <button
                className="icon-btn"
                onClick={() => {
                  setItemActionItem(null)
                  setOpenItemAction(null)
                }}
              >
                ✕
              </button>
            </div>
            <p className="order-meta">Update item name or price below.</p>
            <div className="modal__items">
              <label className="field">
                <span>Name</span>
                <input
                  className="field-input"
                  placeholder="Name"
                  value={itemActionName}
                  onChange={(e) => setItemActionName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Price</span>
                <input
                  className="field-input"
                  placeholder="Price"
                  type="number"
                  value={itemActionPrice}
                  onChange={(e) => setItemActionPrice(e.target.value)}
                />
              </label>
            </div>
            <div className="confirm-actions">
              <button
                className="pill-btn"
                onClick={() => {
                  setItemActionItem(null)
                  setOpenItemAction(null)
                }}
              >
                Cancel
              </button>
              <button className="primary" onClick={updateItem}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingItemDelete && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Confirm delete</h3>
            </div>
            <p className="order-meta">
              Are you sure you want to delete <strong>{pendingItemDelete.name}</strong>?
            </p>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setPendingItemDelete(null)}>
                Cancel
              </button>
              <button
                className="pill-btn danger"
                onClick={() => {
                  deleteItem(pendingItemDelete.id)
                  setPendingItemDelete(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {actionWaiter && actionType === 'reset' && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Reset PIN</h3>
              <button className="icon-btn" onClick={() => { setActionWaiter(null); setActionType(null) }}>
                ✕
              </button>
            </div>
            <p className="order-meta">
              Reset PIN for <strong>{actionWaiter.name}</strong> to 0000?
            </p>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => { setActionWaiter(null); setActionType(null) }}>
                Cancel
              </button>
              <button
                className="pill-btn warn"
                onClick={() => {
                  resetWaiterPin(actionWaiter.id)
                  setActionWaiter(null)
                  setActionType(null)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {actionWaiter && actionType === 'profile' && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Edit Waiter</h3>
              <button className="icon-btn" onClick={() => { setActionWaiter(null); setActionType(null) }}>
                ✕
              </button>
            </div>
            <div className="modal__items">
              <input
                className="field-input"
                placeholder="Name"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Phone"
                value={actionPhone}
                onChange={(e) => setActionPhone(e.target.value)}
              />
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => { setActionWaiter(null); setActionType(null) }}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  updateWaiterProfile(actionWaiter.id, actionName, actionPhone)
                  setActionWaiter(null)
                  setActionType(null)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
