import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/admin',
    name: 'AdminHome',
    component: () => import('../views/AdminHome.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/user',
    name: 'UserHome',
    component: () => import('../views/UserHome.vue'),
    meta: { requiresAuth: true, role: 'student' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')

  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
    } else if (to.meta.role && to.meta.role !== userInfo.role) {
      // 角色不匹配，跳回对应首页
      next(userInfo.role === 'admin' ? '/admin' : '/user')
    } else {
      next()
    }
  } else {
    if (token && to.path === '/login') {
      next(userInfo.role === 'admin' ? '/admin' : '/user')
    } else {
      next()
    }
  }
})

export default router
