import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { app } from './firebase'
import { getDatabase, onValue, push, ref, remove, set, update } from 'firebase/database'
import loadingGif from './assets/laoding.gif'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import {
  FiHome,
  FiFileText,
  FiUsers,
  FiBox,
  FiBarChart2,
  FiMenu,
  FiX,
  FiDollarSign,
  FiList,
  FiUserCheck,
  FiClipboard,
  FiGrid,
} from 'react-icons/fi'

ChartJS.register(ArcElement, Tooltip, Legend)

type Role = 'admin' | 'waiter' | 'collector'

type User = {
  id: string
  dbId?: string
  name: string
  role: Role
  phone: string
  pin: string
}

type Item = {
  id: string
  name: string
  price: number
  stock?: number
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
  status?: 'paid' | 'loan' | 'pending'
  collector?: string
}

type LogEntry = {
  id: string
  userId: string
  time: string
  type: string
  detail?: string
}

type Banner = { type: 'success' | 'error'; message: string } | null
type ReportStats = {
  ordersCount: number
  itemsCount: number
  sales: number
  paid: number
  loan: number
  pending: number
}
type ReportRow = ReportStats & { label: string }
type LoanEntry = { id: string; orderId: string; amount: number; date: string; servedBy: string }
type LoanCustomer = { id: string; dbId?: string; name: string; phone: string; loans?: Record<string, LoanEntry> }

const SESSION_KEY = 'rms_session'
const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', waiter: 'Waiter', collector: 'Collector' }
const TRANSLATIONS: Record<'en' | 'so', Record<string, string>> = {
  en: {
    dash: 'Dash',
    orders: 'Orders',
    staff: 'Staff',
    items: 'Items',
    reports: 'Reports',
    loans: 'Loans',
    loanBook: 'Loan Book',
    searchOrders: 'Search by Order ID (last 4 digits) or User Name',
    searchItems: 'Search items',
    searchUsers: 'Search users by name or phone',
    searchLoanCustomers: 'Search loan customers',
    searchMenu: 'Search menu items...',
    addUser: '+ Add user',
    addItem: '+ Add item',
    addLoanCustomer: '+ Add loan customer',
    addLoanEntry: '+ Add loan entry',
    submitOrder: 'Submit Order',
    total: 'Total',
    name: 'Name',
    phone: 'Phone',
    price: 'Price',
    stock: 'Stock',
    statusActive: 'Active',
    statusDone: 'Done',
    statusPending: 'Pending',
    statusPaid: 'Paid',
    statusLoan: 'Loan',
    all: 'All',
    active: 'Active',
    paid: 'Paid',
    loan: 'Loan',
    done: 'Done',
    loginTitle: 'RestoDash Login',
    loginHint: 'Access your management panel.',
    phoneNumber: 'Phone Number',
    pinDigits: 'PIN (4 digits)',
    signIn: 'Sign In',
    dashboardTitle: 'Dashboard',
    ordersTitle: 'Orders',
    itemsTitle: 'Items',
    staffTitle: 'Users',
    reportsTitle: 'Reports',
    loansTitle: 'Loan Book',
    loanOrders: 'Loan Orders',
    loanAmount: 'Loan Amount',
    stockLeft: 'Stock left',
    updateStock: 'Update Stock',
    actions: 'Actions',
    noItems: 'No items found.',
    noUsers: 'No users found.',
    noOrders: 'No orders found.',
    noLoanCustomers: 'No loan customers found.',
    noLoansYet: 'No loans yet.',
    servedBy: 'Served by',
    loanDetails: 'Loan details',
    selectLoanCustomer: 'Select loan customer',
    selectOrder: 'Select order',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    addEntry: 'Add entry',
    addItemTitle: 'Add Item',
    addUserTitle: 'Add User',
    newOrderTitle: 'New Order',
  },
  so: {
    dash: 'Degdeg',
    orders: 'Dalabyo',
    staff: 'Isticmaaleyaal',
    items: 'Alaabo',
    reports: 'Warbixinno',
    loans: 'Dayn',
    loanBook: 'Buugga Deynta',
    searchOrders: 'Raadi dalab (4 lambar dambe) ama magac',
    searchItems: 'Raadi alaabo',
    searchUsers: 'Raadi isticmaaleyaal magac ama telefoon',
    searchLoanCustomers: 'Raadi macaamiisha daynta',
    searchMenu: 'Raadi alaabta menu...',
    addUser: '+ Ku dar isticmaal',
    addItem: '+ Ku dar alaab',
    addLoanCustomer: '+ Ku dar macmiil deyn',
    addLoanEntry: '+ Ku dar deyn',
    submitOrder: 'Gudbi Dalabka',
    total: 'Wadar',
    name: 'Magac',
    phone: 'Telefoon',
    price: 'Qiime',
    stock: 'Kayd',
    statusActive: 'Firfircoon',
    statusDone: 'Dhamey',
    statusPending: 'Sugaya',
    statusPaid: 'bixiyay',
    statusLoan: 'Deyn',
    all: 'Dhammaan',
    active: 'ku taagan',
    paid: 'bixiyay',
    loan: 'Deyn',
    done: 'dhammaaday',
    loginTitle: 'RestoDash Gelid',
    loginHint: 'Gali nidaamka maamulka.',
    phoneNumber: 'Lambarka Telefoonka',
    pinDigits: 'PIN (4 lambar)',
    signIn: 'Gali',
    dashboardTitle: 'Tusmo Araga',
    ordersTitle: 'Dalabyo',
    itemsTitle: 'Alaabo',
    staffTitle: 'Shaaqalaha',
    reportsTitle: 'Warbixinno',
    loansTitle: 'Buugga Deynta',
    loanOrders: 'Dalabyo Deyn',
    loanAmount: 'Wadar Deyn',
    stockLeft: 'int ka hadhay',
    updateStock: 'Cusbooneysii kayd',
    actions: 'sixid',
    noItems: 'Alaab lama helin.',
    noUsers: 'Isticmaal lama helin.',
    noOrders: 'Dalab lama helin.',
    noLoanCustomers: 'Ma jiraan macaamiil deyn.',
    noLoansYet: 'Weli dayn ma jiro.',
    servedBy: 'U adeegey',
    loanDetails: 'Faahfaahinta deynta',
    selectLoanCustomer: 'Dooro macmiil deyn',
    selectOrder: 'Dooro dalab',
    cancel: 'Jooji',
    delete: 'Tirtir',
    edit: 'Wax ka beddel',
    view: 'Fiiri',
    addEntry: 'Ku dar deyn',
    addItemTitle: 'Ku dar Alaab',
    addUserTitle: 'Ku dar Isticmaal',
    newOrderTitle: 'Dalab Cusub',
  },
}

const tr = (lang: 'en' | 'so', key: string) => TRANSLATIONS[lang]?.[key] ?? key

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
const [tab, setTab] = useState<'dash' | 'orders' | 'staff' | 'items' | 'reports' | 'loans'>('dash')
const [language, setLanguage] = useState<'en' | 'so'>('en')
const [showOrderModal, setShowOrderModal] = useState(false)
const [sidebarOpen, setSidebarOpen] = useState(false)
const [profileOpen, setProfileOpen] = useState(false)
const [waiterSearch, setWaiterSearch] = useState('')
const [newWaiterName, setNewWaiterName] = useState('')
const [newWaiterPhone, setNewWaiterPhone] = useState('+25290')
const [newWaiterRole, setNewWaiterRole] = useState<Role>('waiter')
const [waiterModalOpen, setWaiterModalOpen] = useState(false)
const [pendingDelete, setPendingDelete] = useState<User | null>(null)
const [openAction, setOpenAction] = useState<string | null>(null)
const [actionWaiter, setActionWaiter] = useState<User | null>(null)
const [actionType, setActionType] = useState<'reset' | 'profile' | null>(null)
const [actionName, setActionName] = useState('')
const [actionPhone, setActionPhone] = useState('')
const [actionRole, setActionRole] = useState<Role>('waiter')
const [actionPin, setActionPin] = useState('')
  const [itemManageSearch, setItemManageSearch] = useState('')
const [itemModalOpen, setItemModalOpen] = useState(false)
const [newItemName, setNewItemName] = useState('')
const [newItemPrice, setNewItemPrice] = useState('0')
const [newItemStock, setNewItemStock] = useState('0')
const [openItemAction, setOpenItemAction] = useState<string | null>(null)
const [itemActionItem, setItemActionItem] = useState<Item | null>(null)
const [itemActionName, setItemActionName] = useState('')
const [itemActionPrice, setItemActionPrice] = useState('0')
const [itemActionStock, setItemActionStock] = useState('0')
const [stockModalItem, setStockModalItem] = useState<Item | null>(null)
const [stockModalValue, setStockModalValue] = useState('0')
  const [viewItem, setViewItem] = useState<Item | null>(null)
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
const [pendingItemDelete, setPendingItemDelete] = useState<Item | null>(null)
const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'done' | 'paid' | 'loan'>('all')
const [orderWaiterFilter, setOrderWaiterFilter] = useState<'all' | string>('all')
  const [isLoading, setIsLoading] = useState(true)
const [reportTab, setReportTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
const [reportStart, setReportStart] = useState('')
const [reportEnd, setReportEnd] = useState('')
const [reportStatus, setReportStatus] = useState<'all' | 'paid' | 'loan'>('all')
const [logs, setLogs] = useState<LogEntry[]>([])
const profileCardRef = useRef<HTMLDivElement | null>(null)
const avatarRef = useRef<HTMLButtonElement | null>(null)
const [loanCustomers, setLoanCustomers] = useState<LoanCustomer[]>([])
const [loanCustomerSearch, setLoanCustomerSearch] = useState('')
const [loanCustomerModalOpen, setLoanCustomerModalOpen] = useState(false)
const [newLoanCustomerName, setNewLoanCustomerName] = useState('')
const [newLoanCustomerPhone, setNewLoanCustomerPhone] = useState('+25290')
const [loanEntryModalOpen, setLoanEntryModalOpen] = useState(false)
const [loanEntryCustomerId, setLoanEntryCustomerId] = useState('')
const [loanEntryOrderId, setLoanEntryOrderId] = useState('')
const [viewLoanCustomer, setViewLoanCustomer] = useState<LoanCustomer | null>(null)
const [loanStatusModalOpen, setLoanStatusModalOpen] = useState(false)
const [loanStatusOrderId, setLoanStatusOrderId] = useState('')
const [loanStatusCustomerId, setLoanStatusCustomerId] = useState('')
const [loanStatusSearch, setLoanStatusSearch] = useState('')

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
    const staffCount = users.filter((u) => u.role !== 'admin').length
    return { totalOrders, totalItems, lowStock, topWaiterId, totalSales, staffCount }
  }, [orders, items, currentUser, itemsById, users])

  const orderTotal = (order: Order) =>
    order.items.reduce((sum, entry) => sum + entry.qty * (itemsById[entry.itemId]?.price ?? 0), 0)
  const orderTitle = (order: Order) => {
    const firstItem = order.items[0]
    const name = firstItem ? itemsById[firstItem.itemId]?.name : ''
    return name ? `${name} - ${order.id}` : order.id
  }
  const orderPriority = (order: Order) => {
    if (!order.status || order.status === 'pending') return 2
    if (order.status === 'loan') return 1
    return 0
  }
  const nextOrderId = () => {
    const prefix = 'order'
    const maxExisting = orders.reduce((max, o) => {
      const match = /^order(\d+)$/.exec(o.id ?? '')
      if (!match) return max
      const num = Number(match[1])
      return Number.isNaN(num) ? max : Math.max(max, num)
    }, 0)
    return `${prefix}${String(maxExisting + 1).padStart(3, '0')}`
  }
  const draftTotal = Object.entries(draftQty).reduce(
    (sum, [itemId, qty]) => sum + qty * (itemsById[itemId]?.price ?? 0),
    0
  )
  const scopedOrders = orders
  const ordersFiltered = scopedOrders.filter((order) => {
    if (orderWaiterFilter !== 'all' && order.waiterId !== orderWaiterFilter) return false
    const text = `${order.id} ${usersById[order.waiterId]?.name ?? ''}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
  })
  const activeOrders = ordersFiltered.filter((o) => !o.status || o.status === 'pending')
  const paidOrders = ordersFiltered.filter((o) => o.status === 'paid')
  const loanOrders = ordersFiltered.filter((o) => o.status === 'loan')
  const doneOrders = [...paidOrders, ...loanOrders]
  const orderList =
    orderFilter === 'all'
      ? ordersFiltered
      : orderFilter === 'active'
      ? activeOrders
      : orderFilter === 'done'
      ? doneOrders
      : orderFilter === 'paid'
      ? paidOrders
      : loanOrders
  const orderListSorted = [...orderList].sort((a, b) => {
    const pa = orderPriority(a)
    const pb = orderPriority(b)
    if (pa !== pb) return pb - pa
    return new Date(b.time).getTime() - new Date(a.time).getTime()
  })
  const loanTotals = useMemo(
    () => ({
      count: loanOrders.length,
      amount: loanOrders.reduce((sum, o) => sum + orderTotal(o), 0),
    }),
    [loanOrders]
  )
  const getWeekId = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${date.getUTCFullYear()}-W${weekNo}`
  }

  const reportRows = useMemo<ReportRow[]>(() => {
    const start = reportStart ? new Date(reportStart) : null
    const end = reportEnd ? new Date(reportEnd) : null
    if (end) end.setHours(23, 59, 59, 999)

    const filteredOrders = orders.filter((o) => {
      const t = new Date(o.time).getTime()
      if (Number.isNaN(t)) return false
      if (start && t < start.getTime()) return false
      if (end && t > end.getTime()) return false
      if (reportStatus === 'paid' && o.status !== 'paid') return false
      if (reportStatus === 'loan' && o.status !== 'loan') return false
      return true
    })

    const buckets = new Map<string, ReportStats>()
    filteredOrders.forEach((order) => {
      const date = new Date(order.time)
      if (Number.isNaN(date.getTime())) return
      let key = ''
      if (reportTab === 'daily') key = date.toISOString().slice(0, 10)
      if (reportTab === 'weekly') key = getWeekId(date)
      if (reportTab === 'monthly') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (reportTab === 'yearly') key = `${date.getFullYear()}`
      const current = buckets.get(key) ?? { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0, pending: 0 }
      current.ordersCount += 1
      current.itemsCount += order.items.reduce((s, i) => s + i.qty, 0)
      current.sales += order.items.reduce((s, i) => s + i.qty * (itemsById[i.itemId]?.price ?? 0), 0)
      if (order.status === 'loan') current.loan += 1
      else if (order.status === 'paid') current.paid += 1
      else current.pending += 1
      buckets.set(key, current)
    })

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([label, stats]) => ({ label, ...stats }))
  }, [orders, itemsById, reportStart, reportEnd, reportTab, reportStatus])
  const staffFiltered = users
    .filter((u) => {
      const text = `${u.name} ${u.phone}`.toLowerCase()
      return text.includes(waiterSearch.trim().toLowerCase())
    })

  const itemsFiltered = items.filter((item) =>
    item.name.toLowerCase().includes(itemManageSearch.trim().toLowerCase())
  )
  const waiterCharts = useMemo(() => {
    const waiters = users.filter((u) => u.role === 'waiter')
    return waiters.map((w) => {
      const list = orders.filter((o) => o.waiterId === w.id)
      return {
        waiter: w,
        orders: list.length,
        loan: list.filter((o) => o.status === 'loan').length,
        paid: list.filter((o) => o.status !== 'loan').length,
      }
    })
  }, [users, orders])
  const chartPalette = ['#0ea44d', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
  const waiterStatusStats = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'paid').length
    const loan = orders.filter((o) => o.status === 'loan').length
    const pending = orders.filter((o) => !o.status || o.status === 'pending').length
    return { paid, loan, pending, total: orders.length }
  }, [orders])

  const addLog = (entry: Omit<LogEntry, 'id'>) => {
    push(dbPath('log'), entry).catch(() => null)
  }

  const renderLogMessage = (log: LogEntry) => {
    const actor = usersById[log.userId]?.name ?? log.userId
    switch (log.type) {
      case 'login':
        return `${actor} login`
      case 'waiter_add':
        return `${actor} added staff ${log.detail ?? ''}`.trim()
      case 'waiter_update':
        return `${actor} updated staff ${log.detail ?? ''}`.trim()
      case 'waiter_reset_pin':
        return `${actor} reset staff PIN ${log.detail ?? ''}`.trim()
      case 'waiter_delete':
        return `${actor} deleted staff ${log.detail ?? ''}`.trim()
      case 'item_add':
        return `${actor} added item ${log.detail ?? ''}`.trim()
      case 'item_update':
        return `${actor} updated item ${log.detail ?? ''}`.trim()
      case 'item_delete':
        return `${actor} deleted item ${log.detail ?? ''}`.trim()
      default:
        return `${actor} ${log.type}`
    }
  }

  const updateItemStock = (id: string, stockStr: string) => {
    const stock = Number(stockStr)
    if (Number.isNaN(stock) || stock < 0) {
      setBanner({ type: 'error', message: 'Stock must be 0 or above.' })
      return
    }
    update(dbPath(`items/${id}`), { stock })
      .then(() => setBanner({ type: 'success', message: 'Stock updated.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const exportReportCSV = () => {
    const header = ['Period', 'Orders', 'Items', 'Sales', 'Paid', 'Loan', 'Pending']
    const rows = reportRows.map((r) => [r.label, r.ordersCount, r.itemsCount, r.sales.toFixed(2), r.paid, r.loan, r.pending ?? 0])
    const total = reportRows.reduce(
      (acc, r) => ({
        ordersCount: acc.ordersCount + r.ordersCount,
        itemsCount: acc.itemsCount + r.itemsCount,
        sales: acc.sales + r.sales,
        paid: acc.paid + r.paid,
        loan: acc.loan + r.loan,
        pending: acc.pending + (r.pending ?? 0),
      }),
      { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0, pending: 0 }
    )
    rows.push(['Total', total.ordersCount, total.itemsCount, total.sales.toFixed(2), total.paid, total.loan, total.pending])
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
          )}</td><td>${r.paid}</td><td>${r.loan}</td><td>${r.pending}</td></tr>`
      )
      .join('')
    const total = reportRows.reduce(
      (acc, r) => ({
        ordersCount: acc.ordersCount + r.ordersCount,
        itemsCount: acc.itemsCount + r.itemsCount,
        sales: acc.sales + r.sales,
        paid: acc.paid + r.paid,
        loan: acc.loan + r.loan,
        pending: acc.pending + r.pending,
      }),
      { ordersCount: 0, itemsCount: 0, sales: 0, paid: 0, loan: 0, pending: 0 }
    )
    const html = `
      <html>
      <head><title>Reports</title></head>
      <body>
        <h2>Reports</h2>
        <table border="1" cellspacing="0" cellpadding="6">
          <tr><th>Period</th><th>Orders</th><th>Items</th><th>Sales</th><th>Paid</th><th>Loan</th><th>Pending</th></tr>
          ${tableRows}
          <tr><td><strong>Total</strong></td><td>${total.ordersCount}</td><td>${total.itemsCount}</td><td>$${total.sales.toFixed(
            2
          )}</td><td>${total.paid}</td><td>${total.loan}</td><td>${total.pending}</td></tr>
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
    setActionRole('waiter')
    setActionPin('')
    setItemModalOpen(false)
    setPendingItemDelete(null)
    setItemActionItem(null)
    setOpenItemAction(null)
    setViewItem(null)
    setViewOrder(null)
    setOpenAction(null)
    setNewWaiterRole('waiter')
    setLoanCustomerModalOpen(false)
    setLoanEntryModalOpen(false)
    setLoanEntryCustomerId('')
    setLoanEntryOrderId('')
    setViewLoanCustomer(null)
    setLoanStatusModalOpen(false)
    setLoanStatusOrderId('')
    setLoanStatusCustomerId('')
    setLoanStatusSearch('')
    setStockModalItem(null)
    setStockModalValue('0')
  }

  useEffect(() => {
    const unsubUsers = onValue(dbPath('users'), (snap) => {
      const val = snap.val() as Record<string, User> | null
      const list: User[] = val
        ? Object.entries(val).map(([dbId, user]) => {
            const { id: storedId, ...rest } = user as any
            const role = (user as any).role ?? 'waiter'
            return {
              id: storedId ?? dbId,
              dbId,
              ...(rest as Omit<User, 'id' | 'dbId'>),
              role,
            }
          })
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
            stock: item.stock ?? 0,
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
            status: order.status ?? 'pending',
            collector: order.collector ?? '',
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

    const unsubLogs = onValue(dbPath('log'), (snap) => {
      const val = snap.val() as Record<string, any> | null
      const list: LogEntry[] = val
        ? Object.entries(val).map(([id, log]) => ({
            id,
            userId: log.userId,
            time: log.time,
            type: log.type,
            detail: log.detail,
          }))
        : []
      setLogs(list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()))
    })

    const unsubLoanCustomers = onValue(dbPath('loanCustomers'), (snap) => {
      const val = snap.val() as Record<string, any> | null
      const list: LoanCustomer[] = val
        ? Object.entries(val).map(([dbId, cust]) => ({
            id: cust.id ?? dbId,
            dbId,
            name: cust.name,
            phone: cust.phone,
            loans: cust.loans ?? {},
          }))
        : []
      setLoanCustomers(list)
    })

    return () => {
      unsubUsers()
      unsubItems()
      unsubOrders()
      unsubLogs()
      unsubLoanCustomers()
    }
  }, [db, currentUser])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(timer)
  }, [banner])

  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (profileCardRef.current?.contains(target)) return
      if (avatarRef.current?.contains(target)) return
      setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  useEffect(() => {
    if (currentUser) return
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw || users.length === 0) return
    try {
      const parsed = JSON.parse(raw) as { userId: string; expiresAt: number }
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(SESSION_KEY)
        return
      }
      const found = users.find((u) => u.id === parsed.userId)
      if (found) {
        setCurrentUser(found)
        if (found.role === 'waiter') setDraftWaiter(found.id)
        setTab(found.role === 'waiter' || found.role === 'collector' ? 'orders' : 'dash')
      }
    } catch {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [users, currentUser])

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
    const orderId = nextOrderId()
    const itemsMap: Record<string, { qty: number }> = {}
    selected.forEach((s) => {
      itemsMap[s.itemId] = { qty: s.qty }
    })
    const payload = {
      id: orderId,
      waiter_id: draftWaiter,
      time: new Date().toISOString(),
      status: 'pending',
      collector: '',
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
      setBanner({ type: 'error', message: 'Fill name and phone for the new staff member.' })
      return
    }
    const pin = '4321'
    const id = `waiter-${Date.now()}`
    const newUser: User = {
      id,
      name: newWaiterName.trim(),
      phone: newWaiterPhone.trim(),
      pin,
      role: newWaiterRole,
    }
    push(dbPath('users'), newUser)
      .then(() => {
        setNewWaiterName('')
        setNewWaiterPhone('')
        setNewWaiterRole('waiter')
        setWaiterModalOpen(false)
        setBanner({ type: 'success', message: `${ROLE_LABEL[newUser.role]} added.` })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'waiter_add',
          detail: newUser.name,
        })
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
    const stock = Number(newItemStock)
    if (Number.isNaN(price) || price <= 0) {
      setBanner({ type: 'error', message: 'Provide a valid price above 0.' })
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      setBanner({ type: 'error', message: 'Provide a stock 0 or above.' })
      return
    }
    const newItem = { name: newItemName.trim(), price, stock }
    push(dbPath('items'), newItem)
      .then(() => {
        setNewItemName('')
        setNewItemPrice('0')
        setNewItemStock('0')
        setItemModalOpen(false)
        setBanner({ type: 'success', message: 'Item added.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'item_add',
          detail: newItem.name,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateItem = () => {
    if (!itemActionItem) return
    const name = itemActionName.trim()
    const price = Number(itemActionPrice)
    const stock = Number(itemActionStock)
    if (!name) {
      setBanner({ type: 'error', message: 'Provide an item name.' })
      return
    }
    if (Number.isNaN(price) || price <= 0) {
      setBanner({ type: 'error', message: 'Provide a valid price above 0.' })
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      setBanner({ type: 'error', message: 'Provide a stock 0 or above.' })
      return
    }
    update(dbPath(`items/${itemActionItem.id}`), { name, price, stock })
      .then(() => {
        setItemActionItem(null)
        setOpenItemAction(null)
        setBanner({ type: 'success', message: 'Item updated.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'item_update',
          detail: name,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const deleteItem = (id: string) => {
    const name = itemsById[id]?.name ?? id
    remove(dbPath(`items/${id}`))
      .then(() => {
        setBanner({ type: 'success', message: 'Item removed.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'item_delete',
          detail: name,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const addLoanCustomer = () => {
    if (!newLoanCustomerName.trim() || !newLoanCustomerPhone.trim()) {
      setBanner({ type: 'error', message: 'Provide name and phone for loan customer.' })
      return
    }
    const ref = push(dbPath('loanCustomers'))
    const id = ref.key ?? `loan-cust-${Date.now()}`
    const payload = {
      id,
      name: newLoanCustomerName.trim(),
      phone: newLoanCustomerPhone.trim(),
      registeredBy: currentUser?.id ?? 'system',
    }
    set(ref, payload)
      .then(() => {
        setNewLoanCustomerName('')
        setNewLoanCustomerPhone('+25290')
        setLoanCustomerModalOpen(false)
        setBanner({ type: 'success', message: 'Loan customer added.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const addLoanEntry = () => {
    if (!loanEntryCustomerId || !loanEntryOrderId) {
      setBanner({ type: 'error', message: 'Select customer and loan order.' })
      return
    }
    const customer = loanCustomers.find((c) => c.id === loanEntryCustomerId)
    const order = orders.find((o) => o.id === loanEntryOrderId)
    if (!customer || !order) {
      setBanner({ type: 'error', message: 'Invalid selection.' })
      return
    }
    const entryId = `loan-${Date.now()}`
    const amount = orderTotal(order)
    const servedBy = usersById[order.waiterId]?.name ?? order.waiterId
    const entry: LoanEntry = { id: entryId, orderId: order.id, amount, date: order.time, servedBy }
    const pathId = customer.dbId ?? customer.id
    update(dbPath(`loanCustomers/${pathId}/loans/${entryId}`), entry)
      .then(() => {
        setLoanEntryCustomerId('')
        setLoanEntryOrderId('')
        setLoanEntryModalOpen(false)
        setBanner({ type: 'success', message: 'Loan entry added.' })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const addLoanEntryForOrder = (order: Order, customer: LoanCustomer) => {
    const pathId = customer.dbId ?? customer.id
    const existing = Object.values(customer.loans ?? {}).find((l) => l.orderId === order.id)
    if (existing) return Promise.resolve()
    const ref = push(dbPath(`loanCustomers/${pathId}/loans`))
    const entryId = ref.key ?? `loan-${Date.now()}`
    const amount = orderTotal(order)
    const servedBy = usersById[order.waiterId]?.name ?? order.waiterId
    const entry: LoanEntry = { id: entryId, orderId: order.id, amount, date: order.time, servedBy }
    return set(ref, entry)
  }

  const resetWaiterPin = (id: string) => {
    const target = users.find((u) => u.id === id)
    const pathId = target?.dbId ?? id
    update(dbPath(`users/${pathId}`), { pin: '0000' })
      .then(() => {
        setBanner({ type: 'success', message: 'PIN reset to 0000.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'waiter_reset_pin',
          detail: id,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateWaiterProfile = (id: string, name: string, phone: string, role: Role, pin?: string) => {
    const nextName = name.trim()
    const nextPhone = phone.trim()
    if (!nextName || !nextPhone) {
      setBanner({ type: 'error', message: 'Provide both name and phone.' })
      return
    }
    const target = users.find((u) => u.id === id)
    if (target?.role === 'admin' && currentUser?.id !== id) {
      setBanner({ type: 'error', message: 'Admins cannot modify another admin.' })
      return
    }
    if (pin && !/^\d{4}$/.test(pin.trim())) {
      setBanner({ type: 'error', message: 'PIN must be 4 digits.' })
      return
    }
    const enforcedRole = target?.role === 'admin' || currentUser?.id === id ? target?.role ?? role : role
    const pathId = target?.dbId ?? id
    const updatePayload: Partial<User> & { role: Role } = { name: nextName, phone: nextPhone, role: enforcedRole }
    if (pin?.trim()) updatePayload.pin = pin.trim()
    update(dbPath(`users/${pathId}`), updatePayload)
      .then(() => {
        setBanner({ type: 'success', message: 'Staff updated.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'waiter_update',
          detail: nextName,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const deleteWaiter = (id: string) => {
    const target = users.find((u) => u.id === id)
    if (target?.role === 'admin' && currentUser?.id !== id) {
      setBanner({ type: 'error', message: 'Admins cannot remove another admin.' })
      return
    }
    if (currentUser?.id === id) {
      setBanner({ type: 'error', message: 'Cannot delete the signed-in user.' })
      return
    }
    const pathId = target?.dbId ?? id
    remove(dbPath(`users/${pathId}`))
      .then(() => {
        setBanner({ type: 'success', message: 'Staff removed.' })
        addLog({
          userId: currentUser?.id ?? 'system',
          time: new Date().toISOString(),
          type: 'waiter_delete',
          detail: id,
        })
      })
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const updateOrderStatus = (id: string, status: 'paid' | 'loan' | 'pending') => {
    const collector = status === 'paid' || status === 'loan' ? currentUser?.name ?? 'Unknown' : ''
    update(dbPath(`orders/${id}`), { status, collector })
      .then(() => setBanner({ type: 'success', message: 'Order status updated.' }))
      .catch((err) => setBanner({ type: 'error', message: err.message }))
  }

  const statusLabel = (status?: string) => {
    if (!status || status === 'pending') return { text: tr(language, 'statusActive'), tone: 'pending' }
    return { text: tr(language, 'statusDone'), tone: 'done' }
  }

  const handleStatusChange = (order: Order, status: 'paid' | 'loan' | 'pending') => {
    if (status === 'loan') {
      setLoanStatusOrderId(order.id)
      setLoanStatusModalOpen(true)
      setLoanStatusCustomerId('')
      setLoanStatusSearch('')
      return
    }
    updateOrderStatus(order.id, status)
  }

  const confirmLoanStatus = () => {
    if (!loanStatusOrderId || !loanStatusCustomerId) {
      setBanner({ type: 'error', message: 'Select a loan customer.' })
      return
    }
    const order = orders.find((o) => o.id === loanStatusOrderId)
    const customer = loanCustomers.find((c) => c.id === loanStatusCustomerId)
    if (!order || !customer) {
      setBanner({ type: 'error', message: 'Invalid selection.' })
      return
    }
    updateOrderStatus(order.id, 'loan')
    addLoanEntryForOrder(order, customer).finally(() => {
      setLoanStatusModalOpen(false)
      setLoanStatusOrderId('')
      setLoanStatusCustomerId('')
      setLoanStatusSearch('')
    })
  }

  const loanCustomersFiltered = loanCustomers.filter((c) => {
    const text = `${c.name} ${c.phone}`.toLowerCase()
    return text.includes(loanCustomerSearch.trim().toLowerCase())
  })
  const loanCustomersModalFiltered = loanCustomers.filter((c) => {
    const text = `${c.name} ${c.phone}`.toLowerCase()
    return text.includes(loanStatusSearch.trim().toLowerCase())
  })

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
    setTab(match.role === 'waiter' || match.role === 'collector' ? 'orders' : 'dash')
    setSidebarOpen(false)
    setProfileOpen(false)
    addLog({ userId: match.id, time: new Date().toISOString(), type: 'login' })
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ userId: match.id, expiresAt: Date.now() + 60 * 60 * 1000 })
      )
    }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
    }
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
            <h1 className="auth__title">{tr(language, 'loginTitle')}</h1>
            <p className="auth__hint">{tr(language, 'loginHint')}</p>
            <div className="auth__form">
              <label className="field">
                <span>{tr(language, 'phoneNumber')}</span>
                <input
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="e.g., +252901234567"
                />
              </label>
              <label className="field">
                <span>{tr(language, 'pinDigits')}</span>
                <input
                  type="password"
                  value={authPin}
                  onChange={(e) => setAuthPin(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="****"
                />
              </label>
              {authError && <div className="banner banner--error">{authError}</div>}
              <button className="primary auth__btn" onClick={handleLogin}>
                {tr(language, 'signIn')}
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
              <FiGrid className="sidebar__brand-icon" aria-hidden />
              <span>RestoDash</span>
              <button className="icon-btn sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <FiX />
              </button>
            </div>
            <nav className="sidebar__nav">
              <button
                className={`sidebar__item ${tab === 'dash' ? 'active' : ''}`}
                onClick={() => { setTab('dash'); setSidebarOpen(false) }}
              >
                <FiHome /> <span>{tr(language, 'dashboardTitle')}</span>
              </button>
              <button
                className={`sidebar__item ${tab === 'orders' ? 'active' : ''}`}
                onClick={() => { setTab('orders'); setSidebarOpen(false) }}
              >
                <FiFileText /> <span>{tr(language, 'orders')}</span>
              </button>
              <button
                className={`sidebar__item ${tab === 'loans' ? 'active' : ''}`}
                onClick={() => { setTab('loans'); setSidebarOpen(false) }}
              >
                <FiDollarSign /> <span>{tr(language, 'loans')}</span>
              </button>
              <button
                className={`sidebar__item ${tab === 'staff' ? 'active' : ''}`}
                onClick={() => { setTab('staff'); setSidebarOpen(false) }}
              >
                <FiUsers /> <span>{tr(language, 'staff')}</span>
              </button>
              <button
                className={`sidebar__item ${tab === 'items' ? 'active' : ''}`}
                onClick={() => { setTab('items'); setSidebarOpen(false) }}
              >
                <FiBox /> <span>{tr(language, 'items')}</span>
              </button>
              <button
                className={`sidebar__item ${tab === 'reports' ? 'active' : ''}`}
                onClick={() => { setTab('reports'); setSidebarOpen(false) }}
              >
                <FiBarChart2 /> <span>{tr(language, 'reports')}</span>
              </button>
            </nav>
          </aside>
        )}

        <div className="main-column">
          <header className="topbar">
            <div className="topbar__left">
              {isAdmin && (
                <button className="icon-btn ghost-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">
                  {sidebarOpen ? <FiX /> : <FiMenu />}
                </button>
              )}
              <div className={`brand ${isAdmin ? '' : 'brand--standalone'}`}>RestoDash</div>
            </div>
            <div className="topbar__user">
              <div className="quick-actions">
                <button
                  className="lang-chip"
                  onClick={() => setLanguage((prev) => (prev === 'en' ? 'so' : 'en'))}
                  aria-label="Toggle language"
                >
                  {language === 'en' ? 'EN' : 'SO'}
                </button>
              </div>
              <div className="topbar__meta">
                <strong>{currentUser.name}</strong>
                <span>{ROLE_LABEL[currentUser.role]}</span>
              </div>
              <button
                ref={avatarRef}
                className="avatar"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Profile menu"
              >
                {currentUser.name.charAt(0)}
              </button>
              {profileOpen && (
                <div className="profile-card" ref={profileCardRef}>
                  <p className="profile-name">{currentUser.name}</p>
                  <p className="profile-meta">{currentUser.phone}</p>
                  <p className="profile-meta">{ROLE_LABEL[currentUser.role]}</p>
                  <div className="profile-actions">
                    <button
                      className="text-btn"
                      onClick={() => {
                        closeOverlays()
                        setActionWaiter(currentUser)
                        setActionType('profile')
                        setActionName(currentUser.name)
                        setActionPhone(currentUser.phone)
                        setActionRole(currentUser.role)
                        setActionPin('')
                        setProfileOpen(false)
                      }}
                    >
                      Edit profile
                    </button>
                    <button className="signout-btn block" onClick={handleLogout}>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="content">
            {tab === 'dash' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">{tr(language, 'dashboardTitle')}</h1>
                  </div>
                </div>
                {banner && <div className={`banner banner--${banner.type}`}>{banner.message}</div>}
                <div className="card-grid">
                  <div className="metric-card gradient">
                    <p>Sales</p>
                    <strong>{formatPrice(metrics.totalSales)}</strong>
                    <FiDollarSign className="metric-icon" aria-hidden />
                  </div>
                  <div className="metric-card gradient">
                    <p>Active Orders</p>
                    <strong>{metrics.totalOrders}</strong>
                    <FiList className="metric-icon" aria-hidden />
                  </div>
                  {isAdmin && (
                    <div className="metric-card gradient">
                      <p>Staff</p>
                      <strong>{metrics.staffCount}</strong>
                      <FiUserCheck className="metric-icon" aria-hidden />
                    </div>
                  )}
                </div>
                {(waiterCharts.length > 0 || logs.length > 0 || (!isAdmin && waiterStatusStats.total > 0)) && (
                  <div className="chart-row">
                    {isAdmin && waiterCharts.length > 0 && (
                      <div className="panel light chart-panel">
                        <Doughnut
                          data={{
                            labels: waiterCharts.map((w) => usersById[w.waiter.id]?.name ?? w.waiter.id),
                            datasets: [
                              {
                                label: 'Orders',
                                data: waiterCharts.map((w) => w.orders),
                                backgroundColor: chartPalette,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: { legend: { position: 'bottom' } },
                          }}
                        />
                      </div>
                    )}
                    {!isAdmin && waiterStatusStats.total > 0 && (
                      <div className="panel light chart-panel">
                        <Doughnut
                          data={{
                            labels: ['Paid', 'Loan', 'Pending'],
                            datasets: [
                              {
                                data: [waiterStatusStats.paid, waiterStatusStats.loan, waiterStatusStats.pending],
                                backgroundColor: ['#0ea44d', '#f59e0b', '#9ca3af'],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: { legend: { position: 'bottom' } },
                          }}
                        />
                      </div>
                    )}
                    {logs.length > 0 && (
                      <div className="panel light logs-panel">
                        <div className="panel__head">
                          <h3>Recents</h3>
                        </div>
                        <ul className="logs" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {logs.map((log) => (
                            <li key={log.id}>
                              <span className="logs__user">{renderLogMessage(log)}</span>
                              <span className="logs__time">{formatDateTime(log.time)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === 'orders' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">{tr(language, 'ordersTitle')}</h1>
                  </div>
                </div>
              <input
                className="search"
                type="search"
                placeholder={tr(language, 'searchOrders')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
                <div className="toolbar toolbar--inline" style={{ marginTop: 8 }}>
                  <label className="field" style={{ minWidth: 200 }}>
                    <span>Waiter</span>
                    <select
                      className="field-input"
                      value={orderWaiterFilter}
                      onChange={(e) => setOrderWaiterFilter(e.target.value)}
                    >
                      <option value="all">All waiters</option>
                      {users
                        .filter((u) => u.role === 'waiter')
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="chip-row">
                  {(['all', 'active', 'paid', 'loan', 'done'] as const).map((f) => (
                    <button
                      key={f}
                      className={`chip ${orderFilter === f ? 'active' : ''}`}
                      onClick={() => setOrderFilter(f)}
                    >
                      {f === 'all'
                        ? tr(language, 'all')
                        : f === 'active'
                        ? tr(language, 'active')
                        : f === 'paid'
                        ? tr(language, 'paid')
                        : f === 'loan'
                        ? tr(language, 'loan')
                        : tr(language, 'done')}
                    </button>
                  ))}
                </div>
              <div className="order-list-card">
                {orderListSorted.length === 0 && <div className="empty light">{tr(language, 'noOrders')}</div>}
                {orderListSorted.map((order) => (
                  <div
                    key={order.id}
                    className="order-card light"
                    onClick={() => setViewOrder(order)}
                    role="button"
                  >
                          <div className="order-card__row">
                            <div>
                              <p className="order-id">{orderTitle(order)}</p>
                              <p className="order-meta">
                                Served by: {usersById[order.waiterId]?.name ?? order.waiterId}{' '}
                                ({usersById[order.waiterId] ? ROLE_LABEL[usersById[order.waiterId].role] : 'User'})
                              </p>
                            </div>
                            <div className="order-amount">
                              <div className="order-amount__top">
                            <span className="order-price">{formatPrice(orderTotal(order))}</span>
                            <select
                              className="status-select"
                              value={order.status ?? 'pending'}
                              onChange={(e) => handleStatusChange(order, e.target.value as 'paid' | 'loan' | 'pending')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="pending">{tr(language, 'statusPending')}</option>
                              <option value="paid">{tr(language, 'statusPaid')}</option>
                              <option value="loan">{tr(language, 'statusLoan')}</option>
                            </select>
                              </div>
                              <span className={`status-chip ${statusLabel(order.status).tone}`}>
                                {statusLabel(order.status).text}
                              </span>
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
                    <h1 className="page-title">{tr(language, 'staffTitle')}</h1>
                  </div>
                </div>
                <div className="panel light staff-form">
                  <div className="toolbar toolbar--inline">
                    <input
                      className="search"
                      placeholder={tr(language, 'searchUsers')}
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
                      {tr(language, 'addUser')}
                    </button>
                  </div>
                  <div className="table table--staff">
                    <div className="table__head">
                      <span>No.</span>
                      <span>{tr(language, 'name')}</span>
                      <span>{tr(language, 'phone')}</span>
                      <span>{tr(language, 'statusActive')}</span>
                      <span>{tr(language, 'actions')}</span>
                    </div>
                    {staffFiltered.length === 0 && <div className="empty light">{tr(language, 'noUsers')}</div>}
                    {staffFiltered.map((waiter, idx) => {
                      const isTargetAdmin = waiter.role === 'admin'
                      const isSelf = waiter.id === currentUser.id
                      return (
                        <div key={waiter.id} className="table__row">
                          <span>{idx + 1}.</span>
                          <span>{waiter.name}</span>
                          <span>{waiter.phone}</span>
                          <span>{ROLE_LABEL[waiter.role]}</span>
                          <span className="action-menu">
                            {isTargetAdmin && !isSelf ? (
                              <span className="order-meta">Locked</span>
                            ) : (
                              <button
                                className="action-dots"
                onClick={() => {
                  setPendingDelete(null)
                  setActionWaiter(waiter)
                  setActionType(null)
                  setActionRole(waiter.role)
                  setActionPin('')
                  setOpenAction(waiter.id)
                }}
                aria-haspopup="menu"
              >
                ⋮
                              </button>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {tab === 'loans' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">{tr(language, 'loanBook')}</h1>
                  </div>
                </div>
                <div className="toolbar toolbar--inline">
                    <input
                      className="search"
                      placeholder={tr(language, 'searchLoanCustomers')}
                      value={loanCustomerSearch}
                      onChange={(e) => setLoanCustomerSearch(e.target.value)}
                    />
                    <div className="staff-manage__actions">
                      <button
                        className="primary"
                        onClick={() => {
                          closeOverlays()
                          setLoanCustomerModalOpen(true)
                        }}
                      >
                      {tr(language, 'addLoanCustomer')}
                      </button>
                      <button
                        className="pill-btn"
                        onClick={() => {
                          closeOverlays()
                          setLoanEntryModalOpen(true)
                        }}
                      >
                      {tr(language, 'addLoanEntry')}
                      </button>
                    </div>
                </div>
                  <div className="card-grid">
                    <div className="metric-card gradient">
                    <p>{tr(language, 'loanOrders')}</p>
                    <strong>{loanTotals.count}</strong>
                    <FiList className="metric-icon" aria-hidden />
                  </div>
                  <div className="metric-card gradient">
                    <p>{tr(language, 'loanAmount')}</p>
                    <strong>{formatPrice(loanTotals.amount)}</strong>
                    <FiDollarSign className="metric-icon" aria-hidden />
                  </div>
                </div>
                <div className="panel light">
                  {loanCustomersFiltered.length === 0 && <div className="empty light">{tr(language, 'noLoanCustomers')}</div>}
                  {loanCustomersFiltered.map((cust) => {
                    const loans = Object.values(cust.loans ?? {})
                    const totalLoan = loans.reduce((sum, l) => sum + l.amount, 0)
                    const loanCount = loans.length
                    return (
                      <div
                        key={cust.id}
                        className="loan-card"
                        role="button"
                        onClick={() => setViewLoanCustomer(cust)}
                      >
                        <div className="loan-card__header">
                          <div>
                            <p className="loan-name">{cust.name}</p>
                            <p className="order-meta">{cust.phone}</p>
                          </div>
                          <div className="loan-totals">
                            {loanCount > 0 ? (
                              <span className="loan-chip">
                                <span className="dot" /> {loanCount} loan{loanCount === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="order-meta">No loans</span>
                            )}
                            <strong>{formatPrice(totalLoan)}</strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {tab === 'items' && (
              <>
                <div className="page-title-row">
                  <div>
                    <h1 className="page-title">{tr(language, 'itemsTitle')}</h1>
                  </div>
                </div>
                <div className="panel light staff-form">
                  <div className="toolbar toolbar--inline">
                    <input
                      className="search"
                      placeholder={tr(language, 'searchItems')}
                      value={itemManageSearch}
                      onChange={(e) => setItemManageSearch(e.target.value)}
                    />
                    {currentUser.role === 'admin' && (
                      <button
                        className="primary"
                        onClick={() => {
                          closeOverlays()
                          setItemModalOpen(true)
                        }}
                      >
                        {tr(language, 'addItem')}
                      </button>
                    )}
                  </div>
                  <div className="table table--items">
                    <div className="table__head">
                      <span>No.</span>
                      <span>{tr(language, 'name')}</span>
                      <span>{tr(language, 'price')}</span>
                      <span>{tr(language, 'stock')}</span>
                      {currentUser.role === 'admin' && <span>{tr(language, 'actions')}</span>}
                    </div>
                    {itemsFiltered.length === 0 && <div className="empty light">{tr(language, 'noItems')}</div>}
                    {itemsFiltered.map((item, idx) => (
                      <div
                        key={item.id}
                        className="table__row"
                        role={currentUser.role !== 'admin' ? 'button' : undefined}
                        onClick={() => {
                          if (currentUser.role !== 'admin') {
                            setStockModalItem(item)
                            setStockModalValue(String(item.stock ?? 0))
                          }
                        }}
                      >
                        <span>{idx + 1}.</span>
                        <span>{item.name}</span>
                        <span>{formatPrice(item.price)}</span>
                        <span>{item.stock ?? 0}</span>
                        {currentUser.role === 'admin' ? (
                          <div className="action-menu">
                            <button
                              className="action-dots"
                              onClick={() => {
                                setOpenItemAction(item.id)
                                setItemActionItem(item)
                                setItemActionName(item.name)
                                setItemActionPrice(String(item.price))
                                setItemActionStock(String(item.stock ?? 0))
                                setPendingItemDelete(null)
                              }}
                              aria-haspopup="menu"
                            >
                              ⋮
                            </button>
                          </div>
                        ) : null}
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
                    <h1 className="page-title">{tr(language, 'reportsTitle')}</h1>
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
                  <div className="chip-row report-status">
                    {(['all', 'paid', 'loan'] as const).map((status) => (
                      <button
                        key={status}
                        className={`chip ${reportStatus === status ? 'active' : ''}`}
                        onClick={() => setReportStatus(status)}
                      >
                        {status === 'all' ? 'All' : status === 'paid' ? 'Paid' : 'Loan'}
                      </button>
                    ))}
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
                      <span>Pending</span>
                    </div>
                    {reportRows.map((row) => (
                      <div key={row.label} className="table__row">
                        <span>{row.label}</span>
                        <span>{row.ordersCount}</span>
                        <span>{row.itemsCount}</span>
                        <span>{formatPrice(row.sales)}</span>
                        <span>{row.paid}</span>
                        <span>{row.loan}</span>
                        <span>{row.pending ?? 0}</span>
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
                      <span>{reportRows.reduce((s, r) => s + (r.pending ?? 0), 0)}</span>
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
            <FiHome />
            <span>{tr(language, 'dash')}</span>
          </button>
          <button className={`tabbar__btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
            <FiFileText />
            <span>{tr(language, 'orders')}</span>
          </button>
          <button className={`tabbar__btn ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
            <FiBox />
            <span>{tr(language, 'items')}</span>
          </button>
          <button className={`tabbar__btn ${tab === 'loans' ? 'active' : ''}`} onClick={() => setTab('loans')}>
            <FiDollarSign />
            <span>{tr(language, 'loans')}</span>
          </button>
          {currentUser.role === 'admin' && (
            <button className={`tabbar__btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>
              <FiUsers />
              <span>{tr(language, 'staff')}</span>
            </button>
          )}
        </nav>
      )}

      {showOrderModal && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>{tr(language, 'newOrderTitle')}</h3>
              <button className="icon-btn" onClick={() => setShowOrderModal(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <input
              className="search"
              type="search"
              placeholder={tr(language, 'searchMenu')}
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
            <div className="modal__items">
              {items
                .filter((item) => item.name.toLowerCase().includes(itemSearch.trim().toLowerCase()))
                .map((item) => {
                  const qty = draftQty[item.id] ?? 0
                  const stock = typeof item.stock === 'number' ? item.stock : Infinity
                  const remaining = stock === Infinity ? '∞' : Math.max(0, stock - qty)
                  const atCap = stock !== Infinity && qty >= stock
                  return (
                    <div key={item.id} className="item-row">
                      <div>
                        <p className="item-name">{item.name}</p>
                        <p className="item-meta">
                          {formatPrice(item.price)} {stock !== Infinity && <span>· Stock left: {remaining}</span>}
                        </p>
                      </div>
                      <div className="qty-changer">
                        <button
                          className="qty-btn"
                          onClick={() => updateDraftQty(item.id, Math.max(0, qty - 1))}
                          disabled={qty === 0}
                        >
                          −
                        </button>
                        <span className="qty">{qty}</span>
                        <button
                          className="qty-btn plus"
                          onClick={() => updateDraftQty(item.id, stock === Infinity ? qty + 1 : Math.min(stock, qty + 1))}
                          disabled={atCap}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="modal__total">
              <span>{tr(language, 'total')}:</span>
              <strong>{formatPrice(draftTotal)}</strong>
            </div>
            <button className="primary block" onClick={handleCreateOrder}>
              <span className="btn-icon"><FiClipboard aria-hidden /></span> {tr(language, 'submitOrder')}
            </button>
          </div>
        </div>
      )}

      {waiterModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Add User</h3>
              <button className="icon-btn" onClick={() => setWaiterModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal__items">
              <input
                className="field-input"
                placeholder="Name"
                value={newWaiterName}
                onChange={(e) => setNewWaiterName(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Phone"
                value={newWaiterPhone}
                onChange={(e) => setNewWaiterPhone(e.target.value)}
                type="tel"
              />
              <label className="field">
                <span>Role</span>
                <select className="field-input" value={newWaiterRole} onChange={(e) => setNewWaiterRole(e.target.value as Role)}>
                  <option value="waiter">Waiter</option>
                  <option value="collector">Collector</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <p className="order-meta">Default PIN: 4321</p>
            <button className="primary block" onClick={addWaiter}>
              {tr(language, 'addUser')}
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
                <label className="field">
                  <span>Stock</span>
                  <input
                    className="field-input"
                    placeholder="0"
                    type="number"
                    value={newItemStock}
                    min="0"
                    onChange={(e) => setNewItemStock(e.target.value)}
                  />
                </label>
            </div>
            <button className="primary block" onClick={addItem}>
              {tr(language, 'addItem')}
            </button>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Item Details</h3>
              <button className="icon-btn" onClick={() => setViewItem(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal__items">
              <p className="order-meta"><strong>Name:</strong> {viewItem.name}</p>
              <p className="order-meta"><strong>Price:</strong> {formatPrice(viewItem.price)}</p>
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setViewItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewOrder && (
        <div className="modal" onClick={() => setViewOrder(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{orderTitle(viewOrder)}</h3>
              <button className="icon-btn" onClick={() => setViewOrder(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="order-meta">
              Served by:{' '}
              <strong>
                {usersById[viewOrder.waiterId]?.name ?? 'Unknown'} (
                {usersById[viewOrder.waiterId] ? ROLE_LABEL[usersById[viewOrder.waiterId].role] : 'User'})
              </strong>
            </p>
            {viewOrder.collector && (
              <p className="order-meta">
                Collected by: <strong>{viewOrder.collector}</strong>
              </p>
            )}
            <p className="order-meta">Time: {formatDateTime(viewOrder.time)}</p>
            <div className="table">
              <div className="table__head">
                <span>Item</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total</span>
              </div>
              {viewOrder.items.map((it) => {
                const item = itemsById[it.itemId]
                const lineTotal = (item?.price ?? 0) * it.qty
                return (
                  <div key={it.itemId} className="table__row">
                    <span>{item?.name ?? it.itemId}</span>
                    <span>{it.qty}</span>
                    <span>{formatPrice(item?.price ?? 0)}</span>
                    <span>{formatPrice(lineTotal)}</span>
                  </div>
                )
              })}
              <div className="table__row total-row">
                <span>Total</span>
                <span />
                <span />
                <span>{formatPrice(orderTotal(viewOrder))}</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setViewOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {openAction && actionWaiter && (
        <div className="modal" onClick={() => setOpenAction(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Staff Actions</h3>
              <button className="icon-btn" onClick={() => setOpenAction(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="order-meta">
              {actionWaiter.name} &middot; {ROLE_LABEL[actionWaiter.role]}
            </p>
            <div className="modal__items">
              <button
                className="pill-btn"
                onClick={() => {
                  setActionWaiter(actionWaiter)
                  setActionType('profile')
                  setActionName(actionWaiter.name)
                  setActionPhone(actionWaiter.phone)
                  setActionRole(actionWaiter.role)
                  setOpenAction(null)
                }}
              >
                Update
              </button>
              <button
                className="pill-btn warn"
                onClick={() => {
                  setActionWaiter(actionWaiter)
                  setActionType('reset')
                  setOpenAction(null)
                }}
              >
                Reset PIN
              </button>
              <button
                className="pill-btn danger"
                onClick={() => {
                  setPendingDelete(actionWaiter)
                  setOpenAction(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {openItemAction && itemActionItem && (
        <div className="modal" onClick={() => setOpenItemAction(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Item Actions</h3>
              <button className="icon-btn" onClick={() => setOpenItemAction(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="order-meta">{itemActionItem.name}</p>
            <div className="modal__items">
              <button
                className="pill-btn"
                onClick={() => {
                  setViewItem(itemActionItem)
                  setOpenItemAction(null)
                }}
              >
                View
              </button>
              <button
                className="pill-btn"
                onClick={() => {
                  setItemActionItem(itemActionItem)
                  setOpenItemAction(null)
                }}
              >
                Edit
              </button>
              <button
                className="pill-btn danger"
                onClick={() => {
                  setPendingItemDelete(itemActionItem)
                  setOpenItemAction(null)
                }}
              >
                Delete
              </button>
            </div>
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
              <label className="field">
                <span>Stock</span>
                <input
                  className="field-input"
                  placeholder="0"
                  type="number"
                  min="0"
                  value={itemActionStock}
                  onChange={(e) => setItemActionStock(e.target.value)}
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

      {stockModalItem && (
        <div className="modal" onClick={() => setStockModalItem(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Update Stock</h3>
              <button className="icon-btn" onClick={() => setStockModalItem(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="order-meta">
              {stockModalItem.name} &middot; {formatPrice(stockModalItem.price)}
            </p>
            <div className="modal__items">
              <label className="field">
                <span>Stock</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  value={stockModalValue}
                  onChange={(e) => setStockModalValue(e.target.value)}
                />
              </label>
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setStockModalItem(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  updateItemStock(stockModalItem.id, stockModalValue || '0')
                  setStockModalItem(null)
                }}
              >
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
              <h3>Edit Staff</h3>
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
              <label className="field">
                <span>New PIN (optional)</span>
                <input
                  className="field-input"
                  placeholder="4 digits"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={actionPin}
                  onChange={(e) => setActionPin(e.target.value)}
                />
              </label>
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => { setActionWaiter(null); setActionType(null) }}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  updateWaiterProfile(actionWaiter.id, actionName, actionPhone, actionRole, actionPin)
                  setActionWaiter(null)
                  setActionType(null)
                  setActionPin('')
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {loanCustomerModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>{tr(language, 'addLoanCustomer')}</h3>
              <button className="icon-btn" onClick={() => setLoanCustomerModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal__items">
              <input
                className="field-input"
                placeholder="Customer name"
                value={newLoanCustomerName}
                onChange={(e) => setNewLoanCustomerName(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Phone"
                value={newLoanCustomerPhone}
                onChange={(e) => setNewLoanCustomerPhone(e.target.value)}
                type="tel"
              />
            </div>
            <button className="primary block" onClick={addLoanCustomer}>
              {tr(language, 'addLoanCustomer')}
            </button>
          </div>
        </div>
      )}

      {loanEntryModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>{tr(language, 'addLoanEntry')}</h3>
              <button className="icon-btn" onClick={() => setLoanEntryModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal__items">
              <label className="field">
                <span>Customer</span>
                <select
                  className="field-input"
                  value={loanEntryCustomerId}
                  onChange={(e) => setLoanEntryCustomerId(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {loanCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Loan order</span>
                <select
                  className="field-input"
                  value={loanEntryOrderId}
                  onChange={(e) => setLoanEntryOrderId(e.target.value)}
                >
                  <option value="">Select order</option>
                  {loanOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} - {orderTitle(o)} ({formatPrice(orderTotal(o))})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary block" onClick={addLoanEntry}>
              {tr(language, 'addLoanEntry')}
            </button>
          </div>
        </div>
      )}

      {loanStatusModalOpen && (
        <div className="modal">
          <div className="modal__content">
            <div className="modal__head">
              <h3>Select loan customer</h3>
              <button className="icon-btn" onClick={() => setLoanStatusModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <input
              className="search"
              placeholder={tr(language, 'searchLoanCustomers')}
              value={loanStatusSearch}
              onChange={(e) => setLoanStatusSearch(e.target.value)}
            />
            <div className="loan-list" style={{ maxHeight: 280, overflowY: 'auto', marginTop: 10 }}>
              {loanCustomersModalFiltered.length === 0 && <div className="empty light">No customers found.</div>}
              {loanCustomersModalFiltered.map((c) => {
                const total = Object.values(c.loans ?? {}).reduce((s, l) => s + l.amount, 0)
                return (
                  <label key={c.id} className="loan-row" style={{ cursor: 'pointer' }}>
                    <div>
                      <p className="loan-order" style={{ marginBottom: 2 }}>{c.name}</p>
                      <p className="order-meta">{c.phone}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="loan-amount">{formatPrice(total)}</span>
                      <input
                        type="radio"
                        name="loan-customer"
                        checked={loanStatusCustomerId === c.id}
                        onChange={() => setLoanStatusCustomerId(c.id)}
                      />
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setLoanStatusModalOpen(false)}>
                Cancel
              </button>
              <button className="primary" onClick={confirmLoanStatus}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {viewLoanCustomer && (
        <div className="modal" onClick={() => setViewLoanCustomer(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Loan details</h3>
              <button className="icon-btn" onClick={() => setViewLoanCustomer(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="loan-name" style={{ marginBottom: 4 }}>{viewLoanCustomer.name}</p>
            <p className="order-meta">{viewLoanCustomer.phone}</p>
            <div className="loan-totals" style={{ alignItems: 'flex-start', marginTop: 8 }}>
              <span className="loan-chip">
                <span className="dot" /> {Object.keys(viewLoanCustomer.loans ?? {}).length} {tr(language, 'loan')}
                {Object.keys(viewLoanCustomer.loans ?? {}).length === 1 ? '' : 's'}
              </span>
              <strong>
                {formatPrice(
                  Object.values(viewLoanCustomer.loans ?? {}).reduce((s, l) => s + l.amount, 0)
                )}
              </strong>
            </div>
            <div className="loan-list" style={{ marginTop: 10 }}>
              {Object.keys(viewLoanCustomer.loans ?? {}).length === 0 && (
                <div className="empty light">{tr(language, 'noLoansYet')}</div>
              )}
              {Object.values(viewLoanCustomer.loans ?? {}).map((l) => (
                <div key={l.id} className="loan-row">
                  <div>
                    <p className="loan-order">Order {l.orderId}</p>
                    <p className="order-meta">
                      {tr(language, 'servedBy')} {l.servedBy} &middot; {formatDateTime(l.date)}
                    </p>
                  </div>
                  <span className="loan-amount">{formatPrice(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="confirm-actions">
              <button className="pill-btn" onClick={() => setViewLoanCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
