import Order from "../models/Order.js"
import { centsToEuros } from "../models/price.js"
import { getSettings } from "../services/settings.js"

const tableError = (status, code, message) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

// One summary per table with open tickets. aggregate() skips the getters: priceSnapshot stays in cents, so the sum is exact
const summarizeOpenTables = (match) =>
  Order.aggregate([
    { $match: { ...match, closedAt: null } },
    {
      $group: {
        _id: "$tableNumber",
        ticketIds: { $push: "$_id" },
        openTickets: { $sum: 1 },
        round: { $max: "$round" }, // the last ticket sent = current round
        totalCents: { $sum: { $sum: { $map: { input: "$items", as: "item", in: { $multiply: ["$$item.priceSnapshot", "$$item.qty"] } } } } },
        notServed: { $sum: { $cond: [{ $ne: ["$status", "served"] }, 1, 0] } },
        hasReady: { $max: { $eq: ["$status", "ready"] } }, // true if at least one ticket is ready
      },
    },
  ])

// ready: something to bring to the table · preparing: the kitchen still has a ticket · occupied: everything served, guests eating
const tableStatus = (summary) => {
  if (!summary) return "free"
  if (summary.hasReady) return "ready"
  if (summary.notServed > 0) return "preparing"
  return "occupied"
}

export const getTables = async (req, res) => { // GET /api/tables (waiter, admin): one row per table, 1...tableCount
  const { tableCount } = await getSettings()
  const summaries = await summarizeOpenTables({})
  const summaryByTable = new Map(summaries.map((summary) => [summary._id, summary]))

  const tables = []
  for (let number = 1; number <= tableCount; number++) {
    const summary = summaryByTable.get(number)
    tables.push({
      number,
      status: tableStatus(summary),
      openTickets: summary?.openTickets ?? 0,
      round: summary?.round ?? 0,
      total: centsToEuros(summary?.totalCents ?? 0), // cents summed, euros only at the end
      hasReady: summary?.hasReady ?? false,
    })
  }
  res.json(tables)
}

export const closeTable = async (req, res) => { // POST /api/tables/:number/close (waiter, admin): "Libera tavolo"
  const { tableCount } = await getSettings()
  const tableNumber = Number(req.params.number)
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > tableCount) {
    throw tableError(400, "INVALID_TABLE", `Table number must be an integer from 1 to ${tableCount}`)
  }

  const [summary] = await summarizeOpenTables({ tableNumber })
  if (!summary) throw tableError(409, "TABLE_ALREADY_FREE", `Table ${tableNumber} has no open tickets`)

  // Only the tickets summed above: one sent in the meantime stays open instead of closing without being counted
  await Order.updateMany({ _id: { $in: summary.ticketIds } }, { closedAt: new Date() })

  res.json({
    tableNumber,
    closedTickets: summary.openTickets,
    total: centsToEuros(summary.totalCents),
    notServed: summary.notServed, // tickets closed before being served (the confirm modal already warned)
  })
}
