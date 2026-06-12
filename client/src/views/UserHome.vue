<template>
  <div class="user-page">
    <el-header class="header">
      <span class="header-title">学生就业信息记录系统</span>
      <div class="header-right">
        <el-tag type="success" size="large" effect="plain">学生</el-tag>
        <span class="header-user">{{ userInfo.username }}</span>
        <el-button type="danger" plain size="small" @click="handleLogout" class="logout-btn">退出登录</el-button>
      </div>
    </el-header>

    <div class="layout">
      <el-aside width="200px" class="aside">
        <el-menu default-active="1" class="side-menu">
          <el-menu-item index="1"><span>📝 我的就业信息</span></el-menu-item>
          <el-menu-item index="2" @click="showPwdDialog = true"><span>🔒 修改密码</span></el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="main-content">
        <div v-if="myData && myData.id">
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>我的就业信息</span>
                <el-button type="primary" size="small" @click="openEditDialog">✏️ 修改</el-button>
              </div>
            </template>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="学号">{{ myData.username }}</el-descriptions-item>
              <el-descriptions-item label="姓名">{{ myData.name }}</el-descriptions-item>
              <el-descriptions-item label="院系">{{ myData.department || '未填写' }}</el-descriptions-item>
              <el-descriptions-item label="班级">{{ myData.class_name || '未填写' }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ myData.phone || '未填写' }}</el-descriptions-item>
              <el-descriptions-item label="就业状态">
                <el-tag v-if="myData.employment_status" :type="statusTagType(myData.employment_status)" size="small">
                  {{ myData.employment_status.replace(/-/g, '/') }}
                </el-tag>
                <span v-else>未填写</span>
              </el-descriptions-item>
              <el-descriptions-item label="单位/院校">{{ myData.unit || '未填写' }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ myData.notes || '无' }}</el-descriptions-item>
              <el-descriptions-item label="录入时间">{{ myData.created_at || '' }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ myData.updated_at || '' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </div>
        <div v-else class="empty-state">
          <el-empty description="你还没有录入就业信息">
            <el-button type="primary" @click="openAddDialog">📝 录入就业信息</el-button>
          </el-empty>
        </div>
      </el-main>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '修改就业信息' : '录入就业信息'" width="540px" :close-on-click-modal="false" @close="resetForm">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="90px" size="default">
        <el-form-item label="学号"><el-input :model-value="userInfo.username" disabled /></el-form-item>
        <el-form-item label="姓名"><el-input :model-value="userInfo.name || userInfo.username" disabled /></el-form-item>
        <el-form-item label="院系"><el-input :model-value="userInfo.department || '未填写'" disabled /></el-form-item>
        <el-form-item label="班级"><el-input :model-value="userInfo.class_name || '未填写'" disabled /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="formData.phone" placeholder="选填" /></el-form-item>
        <el-form-item label="就业去向" prop="statusArr">
          <el-cascader v-model="formData.statusArr" :options="categoryOptions"
            :props="{ checkStrictly: false }" placeholder="请选择就业去向" style="width:100%" @change="onCategoryChange" />
        </el-form-item>
        <el-form-item v-if="currentCategory && currentCategory !== '待定'" :label="unitLabel" prop="unit">
          <el-input v-model="formData.unit" :placeholder="unitPlaceholder" />
        </el-form-item>
        <el-form-item v-if="currentCategory === '待定'" label="情况说明">
          <el-input v-model="formData.notes" type="textarea" :rows="2" placeholder="说明当前情况" />
        </el-form-item>
        <el-form-item v-if="currentCategory && currentCategory !== '待定'" label="备注">
          <el-input v-model="formData.notes" type="textarea" :rows="2" placeholder="其他补充信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">{{ isEdit ? '更新' : '录入' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPwdDialog" title="修改密码" width="400px" :close-on-click-modal="false">
      <el-form :model="pwdForm" label-width="80px" size="default" @keyup.enter="handleChangePwd">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少8位，含数字+大小写字母" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPwdDialog = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="handleChangePwd">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEmploymentListAPI, addEmploymentAPI, updateEmploymentAPI, getUserInfoAPI, changePasswordAPI } from '../api/index.js'

const router = useRouter()
const userInfo = ref({})
const myData = ref(null)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)

const categoryOptions = [
  { value: '升学', label: '升学', children: [{ value: '国内', label: '国内升学' }, { value: '出国', label: '出国留学' }]},
  { value: '工作', label: '工作', children: [
    { value: '公务员', label: '公务员' }, { value: '事业单位', label: '事业单位' },
    { value: '市场就业', label: '市场就业' }, { value: '自主创业', label: '自主创业' },
    { value: '灵活就业', label: '灵活就业' }, { value: '参军', label: '参军' }]},
  { value: '待定', label: '待定', children: [{ value: '已有目标', label: '已有目标' }, { value: '暂未就业', label: '暂未就业' }]}
]

const formData = reactive({ statusArr: [], phone: '', unit: '', notes: '' })
const showPwdDialog = ref(false)
const pwdLoading = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '' })
const currentCategory = computed(() => formData.statusArr[0] || '')
const currentSubcategory = computed(() => formData.statusArr[1] || '')
const unitLabel = computed(() => {
  const m = { '升学':'升学院校','公务员':'报考单位','事业单位':'报考单位','市场就业':'就业单位','自主创业':'创业项目','灵活就业':'职业方向','参军':'入伍单位' }
  return m[currentSubcategory.value] || m[currentCategory.value] || '单位/院校'
})
const unitPlaceholder = computed(() => {
  const m = { '升学':'如：清华大学','公务员':'如：XX省教育厅','事业单位':'如：XX市人民医院','市场就业':'如：华为技术有限公司','自主创业':'如：校园文创工作室','灵活就业':'如：自由设计师','参军':'如：中国人民解放军陆军' }
  return m[currentSubcategory.value] || m[currentCategory.value] || ''
})
const rules = { statusArr: [{ required: true, message: '请选择就业去向', trigger: 'change' }] }
const statusTagType = (s) => { if(!s) return 'info'; if(s.startsWith('升学')) return 'success'; if(s.startsWith('工作')) return ''; if(s.startsWith('待定')) return 'warning'; return 'info' }

onMounted(async () => {
  const stored = localStorage.getItem('userInfo'); if (stored) userInfo.value = JSON.parse(stored)
  try { const r = await getUserInfoAPI(); if (r.code===200) userInfo.value = {...userInfo.value,...r.data} } catch(_){}
  await fetchMyData()
})
const fetchMyData = async () => {
  try { const r = await getEmploymentListAPI({page:1,pageSize:1}); myData.value = r.code===200&&r.data.list.length ? r.data.list[0] : null } catch(_) { ElMessage.error('获取数据失败') }
}
const openAddDialog = () => { isEdit.value=false; resetForm(); dialogVisible.value=true }
const openEditDialog = () => {
  isEdit.value=true; const d=myData.value; const p=(d.employment_status||'').split('-')
  formData.statusArr = p.length>=2?[p[0],p[1]]:(p[0]?[p[0]]:[]); formData.phone=d.phone||''; formData.unit=d.unit||''; formData.notes=d.notes||''
  dialogVisible.value=true
}
const onCategoryChange = () => { formData.unit=''; formData.notes='' }
const handleSubmit = async () => {
  if (!await formRef.value.validate().catch(()=>false)) return
  submitLoading.value=true
  try {
    const sp = formData.statusArr.filter(Boolean); const employment_status = sp.join('-')
    const detail = { category:currentCategory.value, subcategory:currentSubcategory.value }
    const payload = { username:userInfo.value.username, name:userInfo.value.name||userInfo.value.username, department:userInfo.value.department||'', class_name:userInfo.value.class_name||'', employment_status, unit:formData.unit||'', phone:formData.phone||'', detail, notes:formData.notes||null }
    const r = isEdit.value ? await updateEmploymentAPI(myData.value.id,payload) : await addEmploymentAPI(payload)
    if (r.code===200) { ElMessage.success(isEdit.value?'修改成功':'录入成功'); dialogVisible.value=false; await fetchMyData() }
    else ElMessage.error(r.message||'操作失败')
  } catch(_) { ElMessage.error('请求失败') } finally { submitLoading.value=false }
}
const resetForm = () => { formData.statusArr=[]; formData.phone=''; formData.unit=''; formData.notes=''; formRef.value&&formRef.value.resetFields() }
const handleChangePwd = async () => {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) return ElMessage.warning('请填写完整')
  if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(pwdForm.newPassword)) return ElMessage.warning('至少8位，需包含数字、大小写字母')
  pwdLoading.value = true
  try {
    const r = await changePasswordAPI({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    if (r.code === 200) { ElMessage.success('密码修改成功'); showPwdDialog.value = false; pwdForm.oldPassword = ''; pwdForm.newPassword = '' }
    else ElMessage.error(r.message || '修改失败')
  } catch (e) { ElMessage.error(e.response?.data?.message || '修改失败') }
  finally { pwdLoading.value = false }
}
const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('userInfo'); router.push('/login') }
</script>

<style scoped>
.user-page { min-height: 100vh; background: var(--bg-page); display: flex; flex-direction: column; }
.header { background: #2c2c2c; color: #e8e4df; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; border-bottom: 1px solid #3a3a3a; flex-shrink: 0; }
.header-title { font-size: 16px; font-weight: 500; letter-spacing: 1px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.header-user { color: #bbb; font-size: 13px; }
.logout-btn { --el-button-hover-bg-color: #a35353; --el-button-hover-border-color: #a35353; }
.layout { display: flex; flex: 1; }
.aside { background: #f0ede8; border-right: 1px solid #e8e4df; flex-shrink: 0; }
.side-menu { background: transparent; }
.side-menu .el-menu-item { color: #3c3c3c; font-size: 14px; }
.side-menu .el-menu-item.is-active { background: #e8e1d5; border-left: 3px solid #5b7fa5; color: #3c3c3c; }
.main-content { flex: 1; padding: 24px; }
.info-card { margin-top: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.empty-state { display: flex; justify-content: center; margin-top: 80px; }
</style>
