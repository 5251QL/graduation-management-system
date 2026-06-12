<template>
  <div class="login-page">
    <div class="login-overlay"></div>
    <div class="login-card">
      <h1 class="login-title">学生就业信息记录系统</h1>
      <p class="login-sub">登录以继续</p>

      <el-form ref="formRef" :model="loginForm" :rules="rules" label-width="0" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin" class="login-btn">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { loginAPI } from '../api/index.js'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const loginForm = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await loginAPI({ username: loginForm.username, password: loginForm.password })
    if (res.code === 200) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('userInfo', JSON.stringify(res.data.userInfo))
      ElMessage.success('登录成功！')
      router.push(res.data.userInfo.role === 'admin' ? '/admin' : '/user')
    } else {
      ElMessage.error(res.message || '登录失败')
    }
  } catch (err) {
    const msg = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : '网络错误，请检查后端是否启动'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.querySelectorAll('.login-page .el-input__wrapper').forEach(el => {
    el.style.backgroundColor = 'rgba(255,255,255,0.22)'
    el.style.backdropFilter = 'blur(8px)'
    el.style.webkitBackdropFilter = 'blur(8px)'
    el.style.borderRadius = '8px'
    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(200,195,188,0.4) inset'
  })
})
</script>

<style scoped>
.login-page {
  width: 100vw; height: 100vh;
  position: relative;
  display: flex; justify-content: center; align-items: center;
  background: #f0ede8;
}
.login-overlay {
  position: absolute; inset: 0;
  background: rgba(245, 243, 239, 0.40);
  backdrop-filter: blur(0.5px);
  -webkit-backdrop-filter: blur(0.5px);
}
.login-card {
  position: relative; z-index: 1;
  width: 400px;
  background: rgba(254, 253, 252, 0.92);
  border: 1px solid rgba(200, 195, 188, 0.4);
  border-radius: 14px;
  padding: 44px 40px 36px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
}
.login-title {
  text-align: center; font-size: 20px; font-weight: 500;
  color: #3c3c3c; margin: 0 0 4px;
}
.login-sub {
  text-align: center; font-size: 13px; color: #8c8c8c;
  margin: 0 0 28px;
}
.login-btn {
  width: 100%; height: 42px;
  font-size: 15px; letter-spacing: 2px;
  box-shadow: 0 2px 8px rgba(91,127,165,0.25);
}
</style>

<style>
#app .login-page .el-input__wrapper {
  background-color: rgba(255,255,255,0.22) !important;
  box-shadow:
    0 1px 4px rgba(0,0,0,0.08),
    0 0 0 1px rgba(200,195,188,0.40) inset !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px;
  transition: all 0.25s ease;
}
#app .login-page .el-input__wrapper:hover {
  background-color: rgba(255,255,255,0.32) !important;
}
#app .login-page .el-input.is-focus .el-input__wrapper {
  background-color: rgba(255,255,255,0.40) !important;
  box-shadow:
    0 2px 12px rgba(91,127,165,0.20),
    0 0 0 1.5px rgba(91,127,165,0.50) inset !important;
}
#app .login-page .el-input__inner {
  color: #3c3c3c;
}
#app .login-page .el-input__inner::placeholder {
  color: rgba(60,60,60,0.45);
}
</style>
