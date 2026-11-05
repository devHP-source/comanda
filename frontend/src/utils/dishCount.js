const dishCount = (ticket) => ticket.items.reduce((sum, item) => sum + item.qty, 0) // Plates on a ticket: "2× Involtini" counts as 2

export default dishCount
