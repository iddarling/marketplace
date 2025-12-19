class MarketplaceApp {
    constructor() {
        console.log('🚀 Создаем MarketplaceApp...');
        this.user = null;
        this.addingToCart = {};
        this.init();
    }

    async init() {
        console.log('🔧 Инициализация MarketplaceApp...');
        await this.checkAuth();
        await this.updateCartCount();
        this.setupGlobalEventListeners();
    }

    async checkAuth() {
        try {
            console.log('🔍 Проверяем авторизацию...');
            const response = await fetch('/api/user');
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Ответ от API пользователя:', data);
                
                if (data.success && data.user) {
                    this.user = data.user;
                    console.log('👤 Пользователь найден:', this.user.name);
                    this.updateGlobalAuthUI();
                } else {
                    console.log('⚠️ Пользователь не авторизован или данные некорректны');
                    this.user = null;
                    this.updateGlobalAuthUI(); // Важно: обновляем UI даже если пользователя нет
                }
            } else if (response.status === 401) {
                console.log('🔒 Пользователь не авторизован (401)');
                this.user = null;
                this.updateGlobalAuthUI(); // Важно: обновляем UI
            } else {
                console.log('⚠️ Ошибка HTTP:', response.status);
                this.user = null;
                this.updateGlobalAuthUI(); // Важно: обновляем UI
            }
        } catch (error) {
            console.log('❌ Ошибка проверки авторизации:', error);
            this.user = null;
            this.updateGlobalAuthUI(); // Важно: обновляем UI
        }
    }

    updateGlobalAuthUI() {
    console.log('🎨 Обновляем глобальный UI...');
    console.log('👤 Текущий пользователь:', this.user);
    
    // Ищем элементы разными способами
    const authLinksByClass = document.querySelectorAll('.auth-link');
    const authLinksById = document.getElementById('authLink');
    const authLinks = authLinksByClass.length > 0 ? authLinksByClass : 
                     (authLinksById ? [authLinksById] : []);
    
    console.log('🔍 Найдено элементов auth-link:', authLinks.length);
    
    authLinks.forEach((link, index) => {
        console.log(`   ${index}. Элемент:`, link, 'классы:', link.className);
        
        if (this.user && this.user.name) {
            // Пользователь авторизован
            console.log(`   ${index}. Устанавливаем имя: ${this.user.name}`);
            link.innerHTML = `
                <svg class="icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                ${this.user.name}
            `;
            link.href = '/profile';
        } else {
            // Пользователь не авторизован
            console.log(`   ${index}. Устанавливаем "Войти"`);
            link.innerHTML = `
                <svg class="icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                Войти
            `;
            link.href = '/login';
        }
    });

    // Обновляем кнопки выхода
    const logoutBtns = document.querySelectorAll('.logout-btn');
    console.log('🔍 Найдено кнопок выхода:', logoutBtns.length);
    
    logoutBtns.forEach((btn, index) => {
        console.log(`   ${index}. Кнопка выхода:`, btn);
        
        if (this.user && this.user.name) {
            console.log(`   ${index}. Показываем кнопку выхода`);
            btn.style.display = 'inline-block';
        } else {
            console.log(`   ${index}. Скрываем кнопку выхода`);
            btn.style.display = 'none';
        }
    });
    
    // Показываем/скрываем ссылку на админ-панель
    const adminLinks = document.querySelectorAll('.admin-link');
    console.log('🔍 Найдено ссылок на админку:', adminLinks.length);
    
    adminLinks.forEach((link, index) => {
        console.log(`   ${index}. Ссылка на админку:`, link);
        
        if (this.user && this.user.role === 'admin') {
            console.log(`   ${index}. Показываем админ-панель`);
            link.style.display = 'inline-flex';
        } else {
            console.log(`   ${index}. Скрываем админ-панель`);
            link.style.display = 'none';
        }
    });
    
    // Обновляем приветствие если есть
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        if (this.user && this.user.name) {
            welcomeMessage.textContent = `Добро пожаловать, ${this.user.name}!`;
            welcomeMessage.style.color = '#111827';
        } else {
            welcomeMessage.textContent = 'Найдите то, что вам нужно';
            welcomeMessage.style.color = '#6b7280';
        }
    }
    
    console.log('✅ Глобальный UI обновлен');
}

    async updateCartCount() {
        try {
            console.log('🛒 Обновляем счетчик корзины...');
            const response = await fetch('/api/cart');
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    const totalItems = data.cart.items.reduce((sum, item) => sum + item.quantity, 0);
                    const countElements = document.querySelectorAll('.cart-count');
                    
                    countElements.forEach(element => {
                        element.textContent = totalItems;
                        element.style.display = totalItems > 0 ? 'inline-block' : 'none';
                    });
                    
                    console.log('✅ Счетчик обновлен:', totalItems);
                }
            }
        } catch (error) {
            console.log('❌ Ошибка обновления корзины:', error);
        }
    }

    setupGlobalEventListeners() {
        console.log('🎮 Настраиваем глобальные обработчики...');
        
        // Используем делегирование событий для всей страницы
        document.addEventListener('click', this.handleGlobalClick.bind(this));
    }

    handleGlobalClick = async (e) => {
        // Обработка добавления в корзину
        if (e.target.closest('.add-to-cart')) {
            e.preventDefault();
            await this.handleAddToCart(e);
        }
        
        // Обработка выхода
        if (e.target.closest('.logout-btn')) {
            e.preventDefault();
            await this.handleLogout();
        }
    }

    async handleAddToCart(e) {
        const button = e.target.closest('.add-to-cart');
        if (!button) return;
        
        // Проверяем блокировку
        if (button.disabled || button.dataset.processing === 'true') {
            console.log('⏳ Кнопка уже обрабатывается');
            return;
        }
        
        const productId = button.dataset.productId;
        if (!productId) return;
        
        // Блокируем кнопку
        const originalText = button.textContent;
        button.textContent = 'Добавляем...';
        button.disabled = true;
        button.dataset.processing = 'true';
        
        try {
            console.log('➕ Добавляем товар:', productId);
            
            // Проверяем, не выполняется ли уже запрос для этого продукта
            if (this.addingToCart[productId]) {
                console.log('⏳ Запрос уже выполняется для этого продукта');
                return;
            }
            
            this.addingToCart[productId] = true;
            
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 })
            });

            if (response.status === 401) {
                this.showNotification('Для добавления в корзину необходимо войти в систему', 'error');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await this.updateCartCount();
                    this.showNotification('Товар добавлен в корзину', 'success');
                }
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Ошибка при добавлении в корзину', 'error');
            }
            
        } catch (error) {
            console.error('🔥 Ошибка сети:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            // Разблокируем кнопку
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
                button.dataset.processing = 'false';
                
                // Снимаем флаг
                delete this.addingToCart[productId];
            }, 1000);
        }
    }

    async handleLogout() {
        try {
            console.log('🚪 Выход из системы...');
            const response = await fetch('/api/logout', { method: 'POST' });
            
            if (response.ok) {
                this.user = null;
                this.updateGlobalAuthUI();
                this.updateCartCount();
                window.location.href = '/';
            } else {
                this.showNotification('Ошибка при выходе', 'error');
            }
        } catch (error) {
            console.error('🔥 Ошибка выхода:', error);
            this.showNotification('Ошибка при выходе', 'error');
        }
    }

    showNotification(message, type = 'success') {
        // Удаляем старые уведомления
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, инициализируем MarketplaceApp...');
    
    // Создаем только один экземпляр
    if (!window.marketplaceApp) {
        window.marketplaceApp = new MarketplaceApp();
    } else {
        console.log('ℹ️ MarketplaceApp уже инициализирован, обновляем данные...');
        // Просто обновляем данные
        window.marketplaceApp.checkAuth();
        window.marketplaceApp.updateCartCount();
    }
});

// Добавьте в конец файла app.js

/**
 * Инициализация страницы товаров
 */
function initProductsPage() {
    // Проверяем, находимся ли мы на странице товаров
    if (!document.getElementById('productsGrid')) {
        return;
    }
    
    console.log('📦 Инициализация страницы товаров');
    
    // Инициализация класса ProductsPage из products.js
    // (он будет загружен отдельным файлом)
}

/**
 * Показать уведомление (глобальная функция)
 */
function showNotification(message, type = 'success') {
    // Проверяем, не существует ли уже уведомление
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.padding = '1rem 1.5rem';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    notification.style.animation = 'slideIn 0.3s ease';
    
    if (type === 'success') {
        notification.style.background = '#10b981';
        notification.style.color = 'white';
    } else {
        notification.style.background = '#ef4444';
        notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Обновить счетчик корзины (глобальная функция)
 */
async function updateCartCount() {
    try {
        const response = await fetch('/api/cart/count');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const cartCount = document.getElementById('cartCount');
                const mobileCartCount = document.getElementById('mobileCartCount');
                
                if (cartCount) {
                    cartCount.textContent = data.count;
                    cartCount.style.display = data.count > 0 ? 'inline-block' : 'none';
                }
                
                if (mobileCartCount) {
                    mobileCartCount.textContent = data.count;
                    mobileCartCount.style.display = data.count > 0 ? 'inline-block' : 'none';
                }
            }
        }
    } catch (error) {
        console.error('Ошибка обновления счетчика корзины:', error);
    }
}

// Добавляем стили для уведомлений
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .notification.success {
        background: #10b981;
        color: white;
    }
    
    .notification.error {
        background: #ef4444;
        color: white;
    }
    
    .notification.warning {
        background: #f59e0b;
        color: white;
    }
`;
document.head.appendChild(notificationStyles);

// Инициализация страницы товаров при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductsPage);
} else {
    initProductsPage();
}

// Маршрут для страницы товара
app.get('/product/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'product.html'));
});