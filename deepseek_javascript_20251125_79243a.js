// Supabase配置
const supabaseUrl = 'https://jcfpcophbmuwbsbxkliv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZnBjb3BoYm11d2JzYnhrbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5ODc4MTYsImV4cCI6MjA3OTU2MzgxNn0.Aqhce6LpyWgj44zbRb-lgrT9o9pJWvQ8Nfzg5blVIQA';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    loadOrders();
    setupEventListeners();
});

async function loadOrders(filters = {}) {
    showLoading(true);
    
    try {
        let query = supabaseClient
            .from('欧洲本土')
            .select('*')
            .order('日期', { ascending: false });

        // 应用筛选条件
        if (filters.shop) {
            query = query.eq('店铺名称', filters.shop);
        }
        if (filters.country) {
            query = query.eq('国家', filters.country);
        }
        if (filters.status) {
            query = query.eq('发货状态', filters.status);
        }
        if (filters.search) {
            query = query.or(`订单号.ilike.%${filters.search}%,收件人姓名.ilike.%${filters.search}%`);
        }

        const { data: orders, error } = await query;

        if (error) {
            throw error;
        }

        displayOrders(orders);
        updateStatistics(orders);
        updateFilters(orders);
        showLoading(false);
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showLoading(false);
        alert('加载数据失败: ' + error.message);
    }
}

function displayOrders(orders) {
    const tbody = document.getElementById('orders-table');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="10" class="text-center text-muted py-4">没有找到匹配的订单</td>`;
        tbody.appendChild(row);
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.订单ID}</td>
            <td>${order.店铺名称 || ''}</td>
            <td>${order.订单号 || ''}</td>
            <td>${order.收件人姓名 || ''}</td>
            <td>${order.国家 || ''}</td>
            <td>€${(order.销售价格€ || 0).toFixed(2)}</td>
            <td class="${order.利润€ >= 0 ? 'text-success' : 'text-danger'}">
                €${(order.利润€ || 0).toFixed(2)}
            </td>
            <td>
                <span class="badge ${getStatusBadgeClass(order.发货状态)}">
                    ${order.发货状态 || '未知'}
                </span>
            </td>
            <td>${formatDate(order.日期)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-action" onclick="editOrder(${order.订单ID})">
                    <i class="bi bi-pencil"></i> 编辑
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getStatusBadgeClass(status) {
    switch(status) {
        case '已完成': return 'bg-success';
        case '已发货': return 'bg-primary';
        case '待发货': return 'bg-warning';
        default: return 'bg-secondary';
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
}

function updateStatistics(orders) {
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.销售价格€ || 0), 0);
    const totalProfit = orders.reduce((sum, order) => sum + (order.利润€ || 0), 0);
    const uniqueShops = new Set(orders.map(order => order.店铺名称).filter(Boolean)).size;

    document.getElementById('total-orders').textContent = totalOrders.toLocaleString();
    document.getElementById('total-sales').textContent = '€' + totalSales.toFixed(2);
    document.getElementById('total-profit').textContent = '€' + totalProfit.toFixed(2);
    document.getElementById('total-shops').textContent = uniqueShops;
}

function updateFilters(orders) {
    // 更新店铺筛选选项
    const shopFilter = document.getElementById('shop-filter');
    const shops = [...new Set(orders.map(order => order.店铺名称).filter(Boolean))];
    
    // 清空现有选项（保留"所有店铺"）
    while (shopFilter.children.length > 1) {
        shopFilter.removeChild(shopFilter.lastChild);
    }
    
    shops.forEach(shop => {
        const option = document.createElement('option');
        option.value = shop;
        option.textContent = shop;
        shopFilter.appendChild(option);
    });

    // 更新国家筛选选项
    const countryFilter = document.getElementById('country-filter');
    const countries = [...new Set(orders.map(order => order.国家).filter(Boolean))];
    
    // 清空现有选项（保留"所有国家"）
    while (countryFilter.children.length > 1) {
        countryFilter.removeChild(countryFilter.lastChild);
    }
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });
}

function setupEventListeners() {
    // 筛选条件变化时重新加载数据
    document.getElementById('shop-filter').addEventListener('change', applyFilters);
    document.getElementById('country-filter').addEventListener('change', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('search-input').addEventListener('input', applyFilters);
}

function applyFilters() {
    const filters = {
        shop: document.getElementById('shop-filter').value,
        country: document.getElementById('country-filter').value,
        status: document.getElementById('status-filter').value,
        search: document.getElementById('search-input').value
    };
    loadOrders(filters);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('orders-table').style.display = show ? 'none' : '';
}

async function editOrder(orderId) {
    // 获取订单详情并显示编辑表单
    const { data: order, error } = await supabaseClient
        .from('欧洲本土')
        .select('*')
        .eq('订单ID', orderId)
        .single();

    if (error) {
        alert('获取订单详情失败: ' + error.message);
        return;
    }

    const formHtml = `
        <form id="edit-order-form">
            <input type="hidden" name="订单ID" value="${order.订单ID}">
            
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">发货状态</label>
                        <select class="form-select" name="发货状态">
                            <option value="待发货" ${order.发货状态 === '待发货' ? 'selected' : ''}>待发货</option>
                            <option value="已发货" ${order.发货状态 === '已发货' ? 'selected' : ''}>已发货</option>
                            <option value="已完成" ${order.发货状态 === '已完成' ? 'selected' : ''}>已完成</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">订单状态</label>
                        <input type="text" class="form-control" name="订单状态" value="${order.订单状态 || ''}">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">物流公司</label>
                        <input type="text" class="form-control" name="物流公司" value="${order.物流公司 || ''}">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">快递单号</label>
                        <input type="text" class="form-control" name="快递单号" value="${order.快递单号 || ''}">
                    </div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">备注</label>
                <textarea class="form-control" name="订单状态" rows="3">${order.订单状态 || ''}</textarea>
            </div>

            <div class="text-end">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                <button type="submit" class="btn btn-primary">保存更改</button>
            </div>
        </form>
    `;

    document.getElementById('edit-form').innerHTML = formHtml;
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();

    // 处理表单提交
    document.getElementById('edit-order-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await updateOrder(this);
        modal.hide();
    });
}

async function updateOrder(form) {
    const formData = new FormData(form);
    const updates = Object.fromEntries(formData.entries());

    const { error } = await supabaseClient
        .from('欧洲本土')
        .update(updates)
        .eq('订单ID', updates.订单ID);

    if (error) {
        alert('更新失败: ' + error.message);
    } else {
        alert('更新成功!');
        loadOrders(); // 重新加载数据
    }
}