<template>
  <div class="admin-page">
    <el-header class="header">
      <span class="header-title">学生就业信息记录系统</span>
      <div class="header-right">
        <el-tag type="danger" size="large" effect="plain">管理员</el-tag>
        <span class="header-user">{{ userInfo.username }}</span>
        <el-button type="danger" plain size="small" @click="handleLogout" class="logout-btn">退出登录</el-button>
      </div>
    </el-header>

    <div class="content">
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="学号">
          <el-input v-model="searchForm.username" placeholder="输入学号搜索" clearable style="width: 160px;" />
        </el-form-item>
        <el-form-item label="院系">
          <el-select v-model="searchForm.department" placeholder="全部院系" clearable style="width: 150px;">
            <el-option label="全部" value="" />
            <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="searchForm.class_name" placeholder="全部班级" clearable style="width: 150px;">
            <el-option label="全部" value="" />
            <el-option v-for="c in classes" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="去向">
          <el-cascader v-model="searchForm.status" :options="statusFilterOptions"
            :props="{ checkStrictly: true, emitPath: false }" placeholder="全部状态" clearable style="width: 180px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="openDialog()">录入信息</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="toolbar-card">
      <el-button type="primary" @click="handleImport">📥 导入Excel</el-button>
      <el-button @click="handleExport('excel')">导出 Excel</el-button>
      <el-button @click="handleExport('pdf')">导出 PDF</el-button>
      <el-button type="info" plain @click="handleBatchDelete">批量删除</el-button>
      <el-button type="danger" plain @click="handleDeleteAll" :disabled="pagination.total === 0">删除筛选全部</el-button>
      <el-button type="warning" plain @click="handleBatchResetPassword">批量重置密码</el-button>
      <span class="total-hint">当前筛选共 {{ pagination.total }} 条</span>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display: none;" @change="onFileChange" />
    </el-card>

    <el-card class="table-card">
      <el-table :data="tableData" v-loading="loading" @selection-change="handleSelectionChange" stripe>
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="姓名" width="90" />
        <el-table-column prop="username" label="学号" width="130" />
        <el-table-column prop="department" label="院系" width="130" />
        <el-table-column prop="class_name" label="班级" width="130" />
        <el-table-column label="去向状态" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.employment_status" :type="statusTagType(row.employment_status)" size="small">
              {{ row.employment_status.replace(/-/g, '/') }}
            </el-tag>
            <el-tag v-else type="info" size="small">未填写</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位/院校" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openDialog(row)">编辑</el-button>
            <el-button type="danger" size="small" link @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination style="margin-top: 16px; justify-content: flex-end;" background
        layout="total, sizes, prev, pager, next, jumper" :page-sizes="[10, 20, 50, 100, 200]"
        :total="pagination.total" :page-size="pagination.pageSize" :current-page="pagination.page"
        @size-change="handleSizeChange" @current-change="handleCurrentChange" />
    </el-card>
    </div>

    <el-dialog v-model="dialogVisible" title="录入/编辑就业信息" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="学号"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="院系">
          <el-select v-model="form.department" placeholder="请选择" style="width:100%">
            <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级"><el-input v-model="form.class_name" /></el-form-item>
        <el-form-item label="去向状态">
          <el-cascader v-model="form.statusArr" :options="statusEditOptions" :props="{ emitPath: true }"
            clearable placeholder="请选择去向" @change="handleStatusChange" style="width:100%" />
        </el-form-item>
        <el-form-item label="单位/院校"><el-input v-model="form.unit" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="form.username && form.username !== 'admin'" type="warning" plain @click="handleResetPassword">🔒 重置密码</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getEmploymentListAPI, addEmploymentAPI, updateEmploymentAPI,
  deleteEmploymentAPI, batchDeleteEmploymentAPI, batchDeleteAllAPI, getOptionsAPI,
  resetPasswordAPI, batchResetPasswordAPI,
} from '../api/index.js'
import api from '../api/index.js'

const router = useRouter()
const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))
const departments = ref([])
const classes = ref([])

const statusFilterOptions = [
  { value: '升学', label: '升学', children: [
    { value: '升学-国内', label: '国内升学' }, { value: '升学-出国', label: '出国留学' }]},
  { value: '工作', label: '工作', children: [
    { value: '国家单位', label: '国家单位', children: [
      { value: '工作-公务员', label: '公务员' }, { value: '工作-事业单位', label: '事业单位' }]},
    { value: '就业', label: '市场就业', children: [
      { value: '工作-市场就业', label: '市场就业' }, { value: '工作-自主创业', label: '自主创业' },
      { value: '工作-灵活就业', label: '灵活就业' }]},
    { value: '参军', label: '参军', children: [{ value: '工作-参军', label: '参军' }]},
    { value: '待定', label: '待定', children: [
      { value: '待定-已有目标', label: '已有目标' }, { value: '待定-暂未就业', label: '暂未就业' }]}]}
]

const statusEditOptions = [
  { value: '升学', label: '升学', children: [{ value: '国内', label: '国内升学' }, { value: '出国', label: '出国留学' }]},
  { value: '工作', label: '工作', children: [
    { value: '公务员', label: '公务员' }, { value: '事业单位', label: '事业单位' },
    { value: '市场就业', label: '市场就业' }, { value: '自主创业', label: '自主创业' },
    { value: '灵活就业', label: '灵活就业' }, { value: '参军', label: '参军' }]},
  { value: '待定', label: '待定', children: [{ value: '已有目标', label: '已有目标' }, { value: '暂未就业', label: '暂未就业' }]}
]

const statusTagType = (s) => {
  if (!s) return 'info'
  if (s.startsWith('升学')) return 'success'
  if (s.startsWith('工作')) return ''
  if (s.startsWith('待定')) return 'warning'
  return 'info'
}

const searchForm = reactive({ username: '', department: '', class_name: '', status: '' })
const loading = ref(false)
const tableData = ref([])
const selectedIds = ref([])
const selectedUsernames = ref([])
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const dialogVisible = ref(false)
const fileInput = ref(null)
const form = reactive({ id: null, username: '', name: '', department: '', class_name: '', statusArr: [], employment_status: '', unit: '', phone: '', notes: '' })

const fetchOptions = async () => {
  try { const r = await getOptionsAPI(); if (r.code===200) { departments.value = r.data.departments||[]; classes.value = r.data.classes||[] } } catch (_) {}
}
const fetchList = async () => {
  loading.value = true
  try {
    const r = await getEmploymentListAPI({ page: pagination.page, pageSize: pagination.pageSize, username: searchForm.username||undefined, department: searchForm.department||undefined, class_name: searchForm.class_name||undefined, status: searchForm.status||undefined })
    if (r&&r.data) { tableData.value=r.data.list||[]; pagination.total=r.data.total||0 }
    else ElMessage.error('响应格式异常')
  } catch(e) { ElMessage.error('获取数据失败') } finally { loading.value=false }
}
const handleSearch = () => { pagination.page=1; fetchList() }
const resetSearch = () => { searchForm.username=''; searchForm.department=''; searchForm.class_name=''; searchForm.status=''; handleSearch() }
const handleCurrentChange = (p) => { pagination.page=p; fetchList() }
const handleSizeChange = (s) => { pagination.pageSize=s; pagination.page=1; fetchList() }
const handleSelectionChange = (rows) => { selectedIds.value = rows.map(r=>r.id); selectedUsernames.value = rows.map(r=>r.username) }
const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？','提示',{type:'warning'}); await deleteEmploymentAPI(id); ElMessage.success('删除成功'); fetchList() } catch(_){}
}
const handleBatchDelete = async () => {
  if (!selectedIds.value.length) return ElMessage.warning('请先勾选')
  try { await ElMessageBox.confirm(`确认删除${selectedIds.value.length}条？`,'提示',{type:'warning'}); await batchDeleteEmploymentAPI(selectedIds.value); ElMessage.success('删除成功'); fetchList() } catch(_){}
}
const handleDeleteAll = async () => {
  if (!pagination.total) return ElMessage.warning('没有可删除的记录')
  try { await ElMessageBox.confirm(`确认删除${pagination.total}条？不可恢复！`,'警告',{type:'error',confirmButtonText:'确认删除'}); await batchDeleteAllAPI({ username:searchForm.username||undefined, department:searchForm.department||undefined, class_name:searchForm.class_name||undefined, status:searchForm.status||undefined }); ElMessage.success('删除成功'); pagination.page=1; fetchList() } catch(_){}
}
const handleImport = () => { fileInput.value.click() }
const onFileChange = async (e) => {
  const file = e.target.files[0]; if (!file) return
  const fd = new FormData(); fd.append('file',file)
  try { const r = await api.post('/employment/import',fd,{headers:{'Content-Type':'multipart/form-data'}}); ElMessage.success(r.message||'导入成功'); fetchList() } catch(e) { ElMessage.error('导入失败:'+(e.response?.data?.message||e.message)) } finally { fileInput.value.value='' }
}
const handleExport = async (type) => {
  try {
    const r = await api.get(`/employment/export/${type}`, { params: { username:searchForm.username||undefined, department:searchForm.department||undefined, class_name:searchForm.class_name||undefined, status:searchForm.status||undefined }, responseType:'blob' })
    const blob = new Blob([r.data],{type:type==='excel'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`employment_${Date.now()}.${type==='excel'?'xlsx':'pdf'}`; a.click(); URL.revokeObjectURL(a.href)
  } catch(_) { ElMessage.error('导出失败') }
}
const openDialog = (row=null) => {
  if (row) {
    Object.assign(form, { id:row.id, username:row.username||'', name:row.name||'', department:row.department||'', class_name:row.class_name||'', unit:row.unit||'', phone:row.phone||'', notes:row.notes||'', employment_status:row.employment_status||'' })
    form.statusArr = row.employment_status&&row.employment_status.includes('-') ? row.employment_status.split('-') : []
  } else { Object.assign(form, { id:null, username:'', name:'', department:'', class_name:'', statusArr:[], employment_status:'', unit:'', phone:'', notes:'' }) }
  dialogVisible.value = true
}
const handleStatusChange = (val) => { form.employment_status = val&&val.length ? val.join('-') : '' }
const handleSubmit = async () => {
  try {
    const payload = { username:form.username, name:form.name, department:form.department, class_name:form.class_name, employment_status:form.employment_status, unit:form.unit, phone:form.phone, notes:form.notes }
    form.id ? await updateEmploymentAPI(form.id,payload) : await addEmploymentAPI(payload)
    ElMessage.success('保存成功'); dialogVisible.value=false; fetchList()
  } catch(_) { ElMessage.error('保存失败') }
}
const handleResetPassword = async () => {
  try {
    await ElMessageBox.confirm(`确认将学生 ${form.username} 的密码重置为默认密码 123456？`, '重置密码', { type: 'warning' })
    const r = await resetPasswordAPI(form.username)
    ElMessage.success(r.message || '重置成功')
  } catch (_) {}
}
const handleBatchResetPassword = async () => {
  if (!selectedUsernames.value.length) return ElMessage.warning('请先勾选学生')
  try {
    await ElMessageBox.confirm(`确认将 ${selectedUsernames.value.length} 名学生的密码重置为默认密码 123456？`, '批量重置密码', { type: 'warning' })
    const r = await batchResetPasswordAPI(selectedUsernames.value)
    ElMessage.success(r.message || '重置成功')
  } catch (_) {}
}
const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('userInfo'); router.push('/login') }
onMounted(() => { fetchOptions(); fetchList() })
</script>

<style scoped>
.admin-page { min-height: 100vh; background: var(--bg-page); }
.header { background: #2c2c2c; color: #e8e4df; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; border-bottom: 1px solid #3a3a3a; }
.header-title { font-size: 16px; font-weight: 500; letter-spacing: 1px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.header-user { color: #bbb; font-size: 13px; }
.logout-btn { --el-button-hover-bg-color: #a35353; --el-button-hover-border-color: #a35353; }
.content { padding: 20px 24px; }
.search-card, .toolbar-card, .table-card { margin-bottom: 16px; }
.total-hint { margin-left: 16px; color: var(--text-secondary); font-size: 13px; }
</style>
