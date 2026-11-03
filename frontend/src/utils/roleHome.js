const ROLE_HOME = { // Each staff role lands on the screen for its duty
  admin: '/admin',
  waiter: '/staff/waiter',
  kitchen: '/staff/kitchen',
}

const roleHome = (role) => ROLE_HOME[role] || '/staff/login'

export default roleHome
