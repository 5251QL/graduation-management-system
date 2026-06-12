import axios from 'axios'

// 创建axios实例，基础地址指向后端
const api = axios.create({
  baseURL: '/api',
  timeout: 120000
})

// 请求拦截器 —— 自动带token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// 响应拦截器 —— 401时自动跳登录
api.interceptors.response.use(
  response => {
    if (response.config.responseType === 'blob') {
      return response
    }
    return response.data
  },
  error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ============ 登录相关 ============
export function loginAPI(data) {
  return api.post('/login', data)
}

export function getUserInfoAPI() {
  return api.get('/user/info')
}

export function changePasswordAPI(data) {
  return api.put('/user/password', data)
}

// ============ 就业信息相关 ============
export function addEmploymentAPI(data) {
  return api.post('/employment/add', data)
}

export function getEmploymentListAPI(params) {
  return api.get('/employment/list', { params })
}

export function getEmploymentDetailAPI(id) {
  return api.get(`/employment/detail/${id}`)
}

export function updateEmploymentAPI(id, data) {
  return api.put(`/employment/update/${id}`, data)
}

export function deleteEmploymentAPI(id) {
  return api.delete(`/employment/delete/${id}`)
}
// ============ 选项数据 ============
export function getOptionsAPI() {
  return api.get('/employment/options')
}

// ============ 导出 ============
export function exportExcelAPI(params) {
  return api.get('/employment/export/excel', { params, responseType: 'blob' })
}

export function exportPdfAPI(params) {
  return api.get('/employment/export/pdf', { params, responseType: 'blob' })
}
// 批量删除
export function batchDeleteEmploymentAPI(ids) {
  return api.post('/employment/batch-delete', { ids })
}
// 删除全部筛选结果
export function batchDeleteAllAPI(params) {
  return api.post('/employment/batch-delete-all', params)
}

// ============ 管理员重置密码 ============
export function resetPasswordAPI(username) {
  return api.put('/admin/reset-password', { username })
}

export function batchResetPasswordAPI(usernames) {
  return api.post('/admin/batch-reset-password', { usernames })
}

export default api
