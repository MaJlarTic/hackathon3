const { app, BrowserWindow, Menu, Tray, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let tray;
let tasks = [];
let deletedTasks = [];

// Путь к файлам
const tasksPath = path.join(app.getPath('userData'), 'tasks.json');
const deletedTasksPath = path.join(app.getPath('userData'), 'deleted.json');

// Загрузка задач
function loadTasks() {
    try {
        if (fs.existsSync(tasksPath)) {
            const data = fs.readFileSync(tasksPath, 'utf8');
            tasks = JSON.parse(data);
        } else {
            tasks = [];
        }
        
        if (fs.existsSync(deletedTasksPath)) {
            const deletedData = fs.readFileSync(deletedTasksPath, 'utf8');
            deletedTasks = JSON.parse(deletedData);
        } else {
            deletedTasks = [];
        }
    } catch (error) {
        tasks = [];
        deletedTasks = [];
    }
}

// Сохранение задач
function saveTasks() {
    try {
        fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения:', error);
    }
}

// Сохранение корзины
function saveDeletedTasks() {
    try {
        fs.writeFileSync(deletedTasksPath, JSON.stringify(deletedTasks, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения корзины:', error);
    }
}

// Создание окна
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: true,
        titleBarStyle: 'default',
        backgroundColor: '#F5F7FA',
        fullscreen: true // Открываем сразу в полноэкранном режиме
    });

    // Загружаем HTML прямо из строки
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Умный планировщик дедлайнов</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #F5F7FA;
            color: #2C3E50;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
        }
        
        .app {
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100vw;
        }
        
        /* Уведомления */
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }

        .notification {
            background: white;
            border-radius: 8px;
            padding: 16px 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            animation: slideIn 0.3s ease;
            pointer-events: auto;
            border-left: 4px solid transparent;
        }

        .notification.error {
            border-left-color: #E74C3C;
        }

        .notification.success {
            border-left-color: #27AE60;
        }

        .notification.warning {
            border-left-color: #F39C12;
        }

        .notification.info {
            border-left-color: #3498DB;
        }

        .notification-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .notification-content {
            flex: 1;
        }

        .notification-title {
            font-size: 16px;
            font-weight: 600;
            color: #2C3E50;
            margin-bottom: 4px;
        }

        .notification-message {
            font-size: 14px;
            color: #7F8C8D;
        }

        .notification-close {
            background: none;
            border: none;
            font-size: 18px;
            color: #95A5A6;
            cursor: pointer;
            padding: 4px;
            flex-shrink: 0;
            transition: color 0.2s;
        }

        .notification-close:hover {
            color: #E74C3C;
        }

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

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        .notification.fade-out {
            animation: slideOut 0.3s ease forwards;
        }
        
        /* Шапка */
        .header {
            background: #2C3E50;
            color: white;
            padding: 16px 24px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding-left: 0; /* Добавить или изменить на нужное значение */
        }

        /* Или более конкретно: */
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            padding-left: 24px; /* Добавить отступ слева именно для контейнера, а не для хедера */
        }

        .logo {
            font-size: 24px;
            font-weight: 600;
            color: white;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: auto;
            margin-left: -24px; /* Компенсировать отступ родителя, если нужно */
        }

        .header-actions {
            display: flex;
            gap: 12px;
            margin-left: auto; /* Это уже есть, оставить */
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .btn-primary {
            background: #3498DB;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2980B9;
        }
        
        .btn-secondary {
            background: #95A5A6;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #7F8C8D;
        }
        
        .btn-danger {
            background: #E74C3C;
            color: white;
        }
        
        .btn-danger:hover {
            background: #C0392B;
        }
        
        .btn-warning {
            background: #F39C12;
            color: white;
        }
        
        .btn-warning:hover {
            background: #E67E22;
        }
        
        .btn-success {
            background: #27AE60;
            color: white;
        }
        
        .btn-success:hover {
            background: #229954;
        }
        
        .btn-calendar {
            background: #9B59B6;
            color: white;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        
        .btn-calendar:hover {
            background: #8E44AD;
        }
        
        .sort-select {
            padding: 8px 12px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 14px;
            cursor: pointer;
        }
        
        .sort-select option {
            background: #2C3E50;
        }
        
        /* Статистика и календарь */
        .stats-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: white;
            border-bottom: 1px solid #E0E0E0;
        }
        
        .stats-left {
            display: flex;
            gap: 32px;
            flex-wrap: wrap;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .stat-label {
            font-size: 14px;
            color: #7F8C8D;
        }
        
        .stat-value {
            font-size: 20px;
            font-weight: 600;
            color: #2C3E50;
        }
        
        .stats-right {
            display: flex;
            align-items: center;
        }
        
        /* Календарь на весь экран */
        .calendar-fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 2000;
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        
        .calendar-fullscreen.show {
            display: flex;
        }
        
        .calendar-header {
            background: #2C3E50;
            color: white;
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .calendar-header-left {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .calendar-header h2 {
            font-size: 28px;
            font-weight: 600;
        }
        
        .calendar-nav-btn {
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .calendar-nav-btn:hover {
            background: rgba(255,255,255,0.2);
        }
        
        .calendar-filters {
            display: flex;
            gap: 12px;
            margin-left: 20px;
            flex: 1;
            justify-content: center;
        }
        
        .calendar-filter-select {
            padding: 8px 16px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 14px;
            cursor: pointer;
            min-width: 150px;
        }
        
        .calendar-filter-select option {
            background: #2C3E50;
            color: white;
        }
        
        .calendar-filter-select:hover {
            background: rgba(255,255,255,0.2);
        }
        
        .calendar-close-btn {
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            font-size: 20px;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .calendar-close-btn:hover {
            background: #E74C3C;
        }
        
        .calendar-content {
            flex: 1;
            padding: 30px;
            display: flex;
            gap: 30px;
            overflow: hidden;
            background: #F5F7FA;
        }
        
        .calendar-main {
            flex: 2;
            background: white;
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
        }
        
        .calendar-weekdays {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .weekday {
            font-size: 16px;
            font-weight: 600;
            color: #7F8C8D;
            padding: 10px;
        }
        
        .calendar-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 10px;
            min-height: 500px;
        }
        
        .calendar-day {
            background: #F8F9FA;
            border-radius: 12px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            min-height: 100px;
            border: 2px solid transparent;
            position: relative;
        }
        
        .calendar-day:hover {
            background: #E8F0FE;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .calendar-day.selected {
            border-color: #3498DB;
            background: #EBF5FF;
        }
        
        .calendar-day.today {
            background: #FFF3E0;
        }
        
        .calendar-day.empty {
            background: transparent;
            cursor: default;
        }
        
        .calendar-day.empty:hover {
            transform: none;
            box-shadow: none;
        }
        
        .calendar-add-btn {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #3498DB;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            border: none;
            z-index: 10;
        }
        
        .calendar-day:hover .calendar-add-btn {
            opacity: 1;
        }
        
        .calendar-add-btn:hover {
            background: #2980B9;
            transform: scale(1.1);
        }
        
        .day-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-right: 25px;
        }
        
        .day-number {
            font-size: 18px;
            font-weight: 600;
            color: #2C3E50;
        }
        
        .day-tasks-count {
            font-size: 12px;
            background: #3498DB;
            color: white;
            padding: 2px 8px;
            border-radius: 20px;
        }
        
        .day-tasks-count.urgent {
            background: #F39C12;
        }
        
        .day-tasks-count.overdue {
            background: #E74C3C;
        }
        
        .day-tasks-count.completed {
            background: #27AE60;
        }
        
        .day-tasks-preview {
            flex: 1;
            overflow: hidden;
        }
        
        .preview-task-item {
            font-size: 12px;
            padding: 4px 6px;
            margin-bottom: 3px;
            background: white;
            border-radius: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-left: 3px solid transparent;
        }
        
        .preview-task-item.high {
            border-left-color: #E74C3C;
        }
        
        .preview-task-item.medium {
            border-left-color: #F39C12;
        }
        
        .preview-task-item.low {
            border-left-color: #27AE60;
        }

        /* Пустое состояние в правой панели календаря */
        .calendar-sidebar .empty-state {
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            transform: translateY(-50%);
            margin: 0;
            padding: 20px;
            width: 100%;
            text-align: center;
        }

        .calendar-sidebar {
            flex: 1;
            background: white;
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            overflow-y: auto;
        }
        
        .calendar-stats {
            background: #F8F9FA;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .calendar-stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            color: #2C3E50;
        }
        
        .calendar-stat-item:last-child {
            margin-bottom: 0;
        }
        
        .calendar-stat-label {
            color: #7F8C8D;
        }
        
        .calendar-stat-value {
            font-weight: 600;
        }
        
        .calendar-stat-value.high {
            color: #E74C3C;
        }
        
        .calendar-stat-value.medium {
            color: #F39C12;
        }
        
        .calendar-stat-value.low {
            color: #27AE60;
        }
        
        .selected-date-title {
            font-size: 20px;
            font-weight: 600;
            color: #2C3E50;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #F0F0F0;
        }
        
        .calendar-add-task-btn {
            width: 100%;
            padding: 12px;
            background: #3498DB;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 20px;
            transition: background 0.2s;
        }
        
        .calendar-add-task-btn:hover {
            background: #2980B9;
        }
        
        .day-tasks-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .day-task-card {
            background: #F8F9FA;
            border-radius: 10px;
            padding: 15px;
            border-left: 4px solid transparent;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
        }
        
        .day-task-card:hover {
            background: #F0F3F8;
            transform: translateX(5px);
        }
        
        .day-task-card.high {
            border-left-color: #E74C3C;
        }
        
        .day-task-card.medium {
            border-left-color: #F39C12;
        }
        
        .day-task-card.low {
            border-left-color: #27AE60;
        }
        
        .day-task-card.completed {
            opacity: 0.7;
            background: #F0F0F0;
        }
        
        .day-task-title {
            font-size: 16px;
            font-weight: 600;
            color: #2C3E50;
            margin-bottom: 5px;
        }
        
        .day-task-time {
            font-size: 13px;
            color: #7F8C8D;
        }
        
        .day-task-status {
            font-size: 12px;
            margin-top: 5px;
            padding: 2px 8px;
            border-radius: 12px;
            display: inline-block;
        }
        
        .status-urgent {
            background: #FFE5E5;
            color: #E74C3C;
        }
        
        .status-overdue {
            background: #FFE5E5;
            color: #E74C3C;
        }
        
        .status-completed {
            background: #E8F5E9;
            color: #27AE60;
        }
        
        /* Основной контент */
        .main {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .tasks-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px 24px;
            overflow: hidden;
        }
        
        .tasks-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .tab-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .tab-btn {
            padding: 8px 16px;
            border: none;
            background: transparent;
            font-size: 14px;
            font-weight: 500;
            color: #7F8C8D;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        
        .tab-btn:hover {
            color: #3498DB;
        }
        
        .tab-btn.active {
            color: #3498DB;
            border-bottom-color: #3498DB;
        }
        
        .tab-btn.urgent-tab.active {
            color: #E74C3C;
            border-bottom-color: #E74C3C;
        }
        
        .tab-btn.deleted-tab.active {
            color: #95A5A6;
            border-bottom-color: #95A5A6;
        }
        
        .tasks-list {
            flex: 1;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 16px;
            align-content: start;
            padding-right: 8px;
            position: relative; /* Добавить эту строку */
            min-height: 400px;  /* Добавить эту строку */
        }
        
        .task-card {
            background: white;
            border-radius: 10px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            border-left: 4px solid transparent;
            display: flex;
            flex-direction: column;
            min-height: 150px;
            max-height: 250px;
            overflow: hidden;
        }
        
        .task-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        
        .task-card.priority-high {
            border-left-color: #E74C3C !important;
        }
        
        .task-card.priority-medium {
            border-left-color: #F39C12 !important;
        }
        
        .task-card.priority-low {
            border-left-color: #27AE60 !important;
        }
        
        .task-card.overdue {
            background: #FFF5F5;
        }
        
        .task-card.urgent {
            background: #FFF0E6;
        }
        
        .task-card.deleted {
            background: #F8F9FA;
            opacity: 0.8;
        }
        
        .task-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
            gap: 8px;
        }
        
        .task-title {
            font-size: 16px;
            font-weight: 600;
            color: #2C3E50;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            max-width: calc(100% - 80px);
            line-height: 1.4;
            max-height: 3.8em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        .task-actions {
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s;
            flex-shrink: 0;
        }
        
        .task-card:hover .task-actions {
            opacity: 1;
        }
        
        .task-action-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            flex-shrink: 0;
        }
        
        .task-action-btn:hover {
            background: #F0F0F0;
        }
        
        .task-action-btn.complete:hover {
            color: #27AE60;
        }
        
        .task-action-btn.edit:hover {
            color: #F39C12;
        }
        
        .task-action-btn.delete:hover {
            color: #E74C3C;
        }
        
        .task-action-btn.restore:hover {
            color: #27AE60;
        }
        
        .task-action-btn.permanent-delete:hover {
            color: #E74C3C;
        }
        
        .task-description {
            font-size: 14px;
            color: #7F8C8D;
            margin-bottom: 12px;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            max-height: 4.5em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            flex: 1;
        }
        
        .task-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            margin-top: auto;
            gap: 8px;
        }
        
        .task-deadline {
            color: #7F8C8D;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .task-time-remaining {
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            white-space: nowrap;
        }
        
        .time-urgent {
            background: #FFE5E5;
            color: #E74C3C;
        }
        
        .time-warning {
            background: #FFF3E0;
            color: #F39C12;
        }
        
        .time-normal {
            background: #E8F5E9;
            color: #27AE60;
        }
        
        /* Модальные окна */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
            z-index: 3000;
        }
        
        .modal.show {
            display: flex;
        }
        
        .modal-content {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #E0E0E0;
        }
        
        .modal-header h2 {
            font-size: 20px;
            font-weight: 600;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: calc(100% - 40px);
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #7F8C8D;
            flex-shrink: 0;
        }
        
        .close-btn:hover {
            color: #2C3E50;
        }
        
        .modal-body {
            padding: 24px;
        }
        
        .modal-footer {
            padding: 20px 24px;
            border-top: 1px solid #E0E0E0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        
        /* Формы */
        .form-group {
            margin-bottom: 16px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #2C3E50;
        }
        
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group input[type="time"],
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #E0E0E0;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
        }
        
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: #3498DB;
            box-shadow: 0 0 0 3px rgba(52,152,219,0.1);
        }
        
        .form-group input:disabled {
            background: #F5F5F5;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        
        .priority-selector {
            display: flex;
            gap: 12px;
        }
        
        .priority-option {
            flex: 1;
            display: flex;
            align-items: center;
            padding: 10px;
            border: 1px solid #E0E0E0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .priority-option:hover {
            background: #F8F9FA;
        }
        
        .priority-option input[type="radio"] {
            margin-right: 8px;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #95A5A6;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            max-width: 500px;
        }
        
        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 16px;
        }
        
        .empty-state h3 {
            font-size: 20px;
            margin-bottom: 8px;
            color: #7F8C8D;
        }
        
        .empty-state p {
            font-size: 14px;
        }
        
        /* Очистить корзину */
        .clear-trash {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px;
        }
        
        /* Детальный просмотр задачи */
        .task-detail-title {
            font-size: 24px;
            font-weight: 600;
            color: #2C3E50;
            margin-bottom: 16px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .task-detail-description {
            font-size: 16px;
            color: #2C3E50;
            line-height: 1.6;
            margin-bottom: 24px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
        }
        
        .task-detail-meta {
            background: #F8F9FA;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
        }
        
        .task-detail-meta-item {
            display: flex;
            margin-bottom: 8px;
        }
        
        .task-detail-meta-label {
            width: 120px;
            font-weight: 600;
            color: #7F8C8D;
        }
        
        .task-detail-meta-value {
            flex: 1;
            color: #2C3E50;
        }
        
        .task-detail-priority {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .priority-high-badge {
            background: #FFE5E5;
            color: #E74C3C;
        }
        
        .priority-medium-badge {
            background: #FFF3E0;
            color: #F39C12;
        }
        
        .priority-low-badge {
            background: #E8F5E9;
            color: #27AE60;
        }
        
        /* Скроллбар */
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #F1F1F1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #C1C1C1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #A8A8A8;
        }
        
        /* Информация об удалении */
        .deleted-info {
            font-size: 12px;
            color: #95A5A6;
            margin-top: 8px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <!-- Уведомления -->
    <div class="notification-container" id="notificationContainer"></div>

    <div class="app">
        <header class="header">
            <div class="header-content">
                <h1 class="logo">📋 Умный планировщик дедлайнов</h1>
                <div class="header-actions">
                    <button class="btn btn-primary" id="newTaskBtn">
                        ➕ Новая задача
                    </button>
                    <select class="sort-select" id="sortSelect">
                        <option value="date">По дате</option>
                        <option value="priority">По важности</option>
                        <option value="title">По названию</option>
                    </select>
                </div>
            </div>
        </header>

        <!-- Статистика слева и кнопка календаря справа -->
        <div class="stats-container">
            <div class="stats-left">
                <div class="stat-item">
                    <span class="stat-label">📊 Всего задач:</span>
                    <span class="stat-value" id="totalTasks">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">✅ Выполнено:</span>
                    <span class="stat-value" id="completedTasks">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🔥 Горящих:</span>
                    <span class="stat-value" id="urgentTasks">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⏳ Просрочено:</span>
                    <span class="stat-value" id="overdueTasks">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🗑️ В корзине:</span>
                    <span class="stat-value" id="deletedTasks">0</span>
                </div>
            </div>
            <div class="stats-right">
                <button class="btn btn-calendar" id="openCalendarBtn">
                    <span>📅</span> Календарь
                </button>
            </div>
        </div>

        <!-- Календарь на весь экран -->
        <div class="calendar-fullscreen" id="calendarFullscreen">
            <div class="calendar-header">
                <div class="calendar-header-left">
                    <button class="calendar-nav-btn" id="calendarPrevMonth">←</button>
                    <h2 id="calendarMonthTitle">Март 2024</h2>
                    <button class="calendar-nav-btn" id="calendarNextMonth">→</button>
                </div>
                <div class="calendar-filters">
                    <select class="calendar-filter-select" id="calendarFilterType">
                        <option value="active">Активные</option>
                        <option value="completed">Выполненные</option>
                        <option value="urgent">Горящие</option>
                        <option value="overdue">Просроченные</option>
                        <option value="all">Все задачи</option>
                    </select>
                    <select class="calendar-filter-select" id="calendarPriorityFilter">
                        <option value="all">Все приоритеты</option>
                        <option value="high">Высокий</option>
                        <option value="medium">Средний</option>
                        <option value="low">Низкий</option>
                    </select>
                </div>
                <button class="calendar-close-btn" id="calendarCloseBtn">✕</button>
            </div>
            <div class="calendar-content">
                <div class="calendar-main">
                    <div class="calendar-weekdays">
                        <div class="weekday">Пн</div>
                        <div class="weekday">Вт</div>
                        <div class="weekday">Ср</div>
                        <div class="weekday">Чт</div>
                        <div class="weekday">Пт</div>
                        <div class="weekday">Сб</div>
                        <div class="weekday">Вс</div>
                    </div>
                    <div class="calendar-grid" id="fullscreenCalendarGrid">
                        <!-- Дни будут сгенерированы здесь -->
                    </div>
                </div>
                <div class="calendar-sidebar" id="calendarSidebar">
                    <div class="calendar-stats" id="calendarStats">
                        <!-- Статистика по фильтру -->
                    </div>
                    <div class="selected-date-title" id="selectedDateTitle">Выберите дату</div>
                    <button class="calendar-add-task-btn" id="calendarAddTaskBtn">
                        ➕ Добавить задачу на выбранный день
                    </button>
                    <div class="day-tasks-list" id="dayTasksList">
                        <!-- Задачи выбранного дня -->
                    </div>
                </div>
            </div>
        </div>

        <main class="main">
            <div class="tasks-container">
                <div class="tasks-header">
                    <div class="tab-buttons">
                        <button class="tab-btn active" data-tab="active">Активные</button>
                        <button class="tab-btn" data-tab="completed">Выполненные</button>
                        <button class="tab-btn urgent-tab" data-tab="urgent">Горящие</button>
                        <button class="tab-btn deleted-tab" data-tab="deleted">Недавно удаленные</button>
                    </div>
                </div>

                <div class="clear-trash" id="clearTrashContainer" style="display: none;">
                    <button class="btn btn-danger" id="clearTrashBtn">🗑️ Очистить корзину</button>
                </div>

                <div class="tasks-list" id="tasksList">
                    <!-- Задачи будут здесь -->
                </div>
            </div>
        </main>

        <!-- Модальное окно задачи -->
        <div class="modal" id="taskModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modalTitle">➕ Новая задача</h2>
                    <button class="close-btn" id="closeModalBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="taskForm">
                        <div class="form-group">
                            <label>Название задачи *</label>
                            <input type="text" id="taskTitle" required placeholder="Например: Сдать лабу по матану">
                        </div>

                        <div class="form-group">
                            <label>Описание</label>
                            <textarea id="taskDescription" rows="3" placeholder="Подробности задачи..."></textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Дата</label>
                                <input type="date" id="taskDate" required>
                            </div>
                            <div class="form-group">
                                <label>Время</label>
                                <input type="time" id="taskTime" value="23:59">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Приоритет</label>
                            <div class="priority-selector">
                                <label class="priority-option">
                                    <input type="radio" name="priority" value="low">
                                    <span>🟢 Низкий</span>
                                </label>
                                <label class="priority-option">
                                    <input type="radio" name="priority" value="medium" checked>
                                    <span>🟠 Средний</span>
                                </label>
                                <label class="priority-option">
                                    <input type="radio" name="priority" value="high">
                                    <span>🔴 Высокий</span>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelModalBtn">Отмена</button>
                    <button class="btn btn-primary" id="saveTaskBtn">Сохранить</button>
                </div>
            </div>
        </div>

        <!-- Модальное окно просмотра задачи -->
        <div class="modal" id="viewTaskModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="viewModalTitle">Просмотр задачи</h2>
                    <button class="close-btn" id="closeViewModalBtn">&times;</button>
                </div>
                <div class="modal-body" id="viewTaskContent">
                    <!-- Контент будет заполнен динамически -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="closeViewBtn">Закрыть</button>
                </div>
            </div>
        </div>

        <!-- Модальное окно подтверждения удаления -->
        <div class="modal" id="deleteModal">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>🗑️ Подтверждение</h2>
                </div>
                <div class="modal-body">
                    <p>Вы уверены, что хотите удалить эту задачу?</p>
                    <p style="font-size: 12px; color: #7F8C8D; margin-top: 8px;">Задача будет перемещена в корзину</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="closeDeleteModalBtn">Отмена</button>
                    <button class="btn btn-danger" id="confirmDeleteBtn">Удалить</button>
                </div>
            </div>
        </div>

        <!-- Модальное окно подтверждения полного удаления -->
        <div class="modal" id="permanentDeleteModal">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>⚠️ Полное удаление</h2>
                </div>
                <div class="modal-body">
                    <p>Вы уверены, что хотите полностью удалить эту задачу?</p>
                    <p style="font-size: 12px; color: #E74C3C; margin-top: 8px;">Это действие нельзя отменить!</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="closePermanentDeleteModalBtn">Отмена</button>
                    <button class="btn btn-danger" id="confirmPermanentDeleteBtn">Полностью удалить</button>
                </div>
            </div>
        </div>

        <!-- Модальное окно подтверждения очистки корзины -->
        <div class="modal" id="clearTrashModal">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>🗑️ Очистка корзины</h2>
                </div>
                <div class="modal-body">
                    <p>Вы уверены, что хотите очистить корзину?</p>
                    <p style="font-size: 12px; color: #E74C3C; margin-top: 8px;">Все задачи будут безвозвратно удалены!</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="closeClearTrashModalBtn">Отмена</button>
                    <button class="btn btn-danger" id="confirmClearTrashBtn">Очистить</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { ipcRenderer } = require('electron');
        
        // Состояние
        let tasks = [];
        let deletedTasks = [];
        let currentTaskId = null;
        let currentTab = 'active';
        let editingId = null;
        let viewingTaskId = null;
        let calendarDate = new Date();
        let selectedCalendarDate = new Date();
        let calendarFilterType = 'active';
        let calendarPriorityFilter = 'all';
        let isFromCalendar = false;
        
        // DOM элементы
        const tasksList = document.getElementById('tasksList');
        const sortSelect = document.getElementById('sortSelect');
        const newTaskBtn = document.getElementById('newTaskBtn');
        const taskModal = document.getElementById('taskModal');
        const viewTaskModal = document.getElementById('viewTaskModal');
        const deleteModal = document.getElementById('deleteModal');
        const permanentDeleteModal = document.getElementById('permanentDeleteModal');
        const clearTrashModal = document.getElementById('clearTrashModal');
        const clearTrashContainer = document.getElementById('clearTrashContainer');
        const clearTrashBtn = document.getElementById('clearTrashBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const closeViewModalBtn = document.getElementById('closeViewModalBtn');
        const closeViewBtn = document.getElementById('closeViewBtn');
        const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
        const closePermanentDeleteModalBtn = document.getElementById('closePermanentDeleteModalBtn');
        const closeClearTrashModalBtn = document.getElementById('closeClearTrashModalBtn');
        const saveTaskBtn = document.getElementById('saveTaskBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const confirmPermanentDeleteBtn = document.getElementById('confirmPermanentDeleteBtn');
        const confirmClearTrashBtn = document.getElementById('confirmClearTrashBtn');
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        // Элементы календаря
        const openCalendarBtn = document.getElementById('openCalendarBtn');
        const calendarFullscreen = document.getElementById('calendarFullscreen');
        const calendarCloseBtn = document.getElementById('calendarCloseBtn');
        const calendarPrevMonth = document.getElementById('calendarPrevMonth');
        const calendarNextMonth = document.getElementById('calendarNextMonth');
        const calendarMonthTitle = document.getElementById('calendarMonthTitle');
        const fullscreenCalendarGrid = document.getElementById('fullscreenCalendarGrid');
        const selectedDateTitle = document.getElementById('selectedDateTitle');
        const dayTasksList = document.getElementById('dayTasksList');
        const calendarFilterTypeSelect = document.getElementById('calendarFilterType');
        const calendarPriorityFilterSelect = document.getElementById('calendarPriorityFilter');
        const calendarStats = document.getElementById('calendarStats');
        const calendarAddTaskBtn = document.getElementById('calendarAddTaskBtn');
        
        // Функция для показа уведомлений
        function showNotification(title, message, type = 'error', duration = 5000) {
            const container = document.getElementById('notificationContainer');
            
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            
            // Выбираем иконку в зависимости от типа
            let icon = '❌';
            if (type === 'success') icon = '✅';
            if (type === 'warning') icon = '⚠️';
            if (type === 'info') icon = 'ℹ️';
            
            notification.innerHTML = \`
                <div class="notification-icon">\${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">\${title}</div>
                    <div class="notification-message">\${message}</div>
                </div>
                <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
            \`;
            
            container.appendChild(notification);
            
            // Автоматическое закрытие через duration миллисекунд
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.add('fade-out');
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, duration);
            
            // Кнопка закрытия
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            });
        }
        
        // Инициализация
        document.addEventListener('DOMContentLoaded', () => {
            loadTasks();
            setDefaultDate();
            startAutoUpdate();
            setupEventListeners();
        });
        
        // Настройка обработчиков событий
        function setupEventListeners() {
            newTaskBtn.addEventListener('click', () => {
                isFromCalendar = false;
                openTaskModal();
            });
            
            calendarAddTaskBtn.addEventListener('click', () => {
                isFromCalendar = true;
                openTaskModal(selectedCalendarDate);
            });
            
            sortSelect.addEventListener('change', renderTasks);
            closeModalBtn.addEventListener('click', closeModal);
            cancelModalBtn.addEventListener('click', closeModal);
            closeViewModalBtn.addEventListener('click', closeViewModal);
            closeViewBtn.addEventListener('click', closeViewModal);
            closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
            closePermanentDeleteModalBtn.addEventListener('click', closePermanentDeleteModal);
            closeClearTrashModalBtn.addEventListener('click', closeClearTrashModal);
            saveTaskBtn.addEventListener('click', saveTask);
            confirmDeleteBtn.addEventListener('click', confirmDelete);
            confirmPermanentDeleteBtn.addEventListener('click', confirmPermanentDelete);
            confirmClearTrashBtn.addEventListener('click', confirmClearTrash);
            
            if (clearTrashBtn) {
                clearTrashBtn.addEventListener('click', openClearTrashModal);
            }
            
            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    switchTab(e.target.dataset.tab, e.target);
                });
            });
            
            // Обработчики календаря
            openCalendarBtn.addEventListener('click', openCalendar);
            calendarCloseBtn.addEventListener('click', closeCalendar);
            calendarPrevMonth.addEventListener('click', () => {
                calendarDate.setMonth(calendarDate.getMonth() - 1);
                renderFullscreenCalendar();
            });
            calendarNextMonth.addEventListener('click', () => {
                calendarDate.setMonth(calendarDate.getMonth() + 1);
                renderFullscreenCalendar();
            });
            
            calendarFilterTypeSelect.addEventListener('change', () => {
                calendarFilterType = calendarFilterTypeSelect.value;
                renderFullscreenCalendar();
            });
            
            calendarPriorityFilterSelect.addEventListener('change', () => {
                calendarPriorityFilter = calendarPriorityFilterSelect.value;
                renderFullscreenCalendar();
            });
        }
        
        // Открытие календаря
        function openCalendar() {
            calendarDate = new Date();
            selectedCalendarDate = new Date();
            renderFullscreenCalendar();
            calendarFullscreen.classList.add('show');
        }
        
        // Закрытие календаря
        function closeCalendar() {
            calendarFullscreen.classList.remove('show');
        }
        
        // Получение отфильтрованных задач на дату
        function getFilteredTasksForDate(date) {
            const dateStr = formatDateKey(date);
            
            // Базовый фильтр по дате
            let filteredTasks = tasks.filter(t => {
                const taskDate = new Date(t.deadline);
                return formatDateKey(taskDate) === dateStr;
            });
            
            // Применяем фильтр по типу
            switch (calendarFilterType) {
                case 'active':
                    filteredTasks = filteredTasks.filter(t => !t.completed);
                    break;
                case 'completed':
                    filteredTasks = filteredTasks.filter(t => t.completed);
                    break;
                case 'urgent':
                    filteredTasks = filteredTasks.filter(t => {
                        if (t.completed) return false;
                        const urgency = calculateUrgency(t);
                        return urgency.urgent;
                    });
                    break;
                case 'overdue':
                    filteredTasks = filteredTasks.filter(t => {
                        if (t.completed) return false;
                        const urgency = calculateUrgency(t);
                        return urgency.overdue;
                    });
                    break;
                case 'all':
                    // Все задачи, включая выполненные
                    break;
            }
            
            // Применяем фильтр по приоритету
            if (calendarPriorityFilter !== 'all') {
                filteredTasks = filteredTasks.filter(t => t.priority === calendarPriorityFilter);
            }
            
            return filteredTasks;
        }
        
        // Обновление статистики календаря
        function updateCalendarStats() {
            const month = calendarDate.getMonth();
            const year = calendarDate.getFullYear();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            let totalTasks = 0;
            let activeTasks = 0;
            let completedTasks = 0;
            let urgentTasks = 0;
            let overdueTasks = 0;
            let priorityCounts = { high: 0, medium: 0, low: 0 };
            
            // Собираем статистику за месяц
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dayTasks = tasks.filter(t => {
                    const taskDate = new Date(t.deadline);
                    return formatDateKey(taskDate) === formatDateKey(date);
                });
                
                dayTasks.forEach(t => {
                    totalTasks++;
                    if (!t.completed) activeTasks++;
                    if (t.completed) completedTasks++;
                    
                    const urgency = calculateUrgency(t);
                    if (!t.completed && urgency.urgent) urgentTasks++;
                    if (!t.completed && urgency.overdue) overdueTasks++;
                    
                    if (t.priority) {
                        priorityCounts[t.priority]++;
                    }
                });
            }
            
            // Отображаем статистику
            calendarStats.innerHTML = \`
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">Всего задач в месяце:</span>
                    <span class="calendar-stat-value">\${totalTasks}</span>
                </div>
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">Активных:</span>
                    <span class="calendar-stat-value">\${activeTasks}</span>
                </div>
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">Выполненных:</span>
                    <span class="calendar-stat-value">\${completedTasks}</span>
                </div>
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">Горящих:</span>
                    <span class="calendar-stat-value urgent">\${urgentTasks}</span>
                </div>
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">Просроченных:</span>
                    <span class="calendar-stat-value overdue">\${overdueTasks}</span>
                </div>
                <div class="calendar-stat-item">
                    <span class="calendar-stat-label">По приоритетам:</span>
                    <span class="calendar-stat-value"></span>
                </div>
                <div class="calendar-stat-item" style="margin-left: 10px;">
                    <span class="calendar-stat-label">🔴 Высокий:</span>
                    <span class="calendar-stat-value high">\${priorityCounts.high}</span>
                </div>
                <div class="calendar-stat-item" style="margin-left: 10px;">
                    <span class="calendar-stat-label">🟠 Средний:</span>
                    <span class="calendar-stat-value medium">\${priorityCounts.medium}</span>
                </div>
                <div class="calendar-stat-item" style="margin-left: 10px;">
                    <span class="calendar-stat-label">🟢 Низкий:</span>
                    <span class="calendar-stat-value low">\${priorityCounts.low}</span>
                </div>
            \`;
        }
        
        // Отрисовка полноэкранного календаря
        function renderFullscreenCalendar() {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth();
            
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            
            calendarMonthTitle.textContent = \`\${monthNames[month]} \${year}\`;
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            const startDay = firstDay.getDay() || 7; // 1 - понедельник, 7 - воскресенье
            const daysInMonth = lastDay.getDate();
            
            fullscreenCalendarGrid.innerHTML = '';
            
            // Пустые ячейки для предыдущего месяца
            for (let i = 1; i < startDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'calendar-day empty';
                fullscreenCalendarGrid.appendChild(emptyDay);
            }
            
            // Ячейки для текущего месяца
            const today = new Date();
            const todayStr = formatDateKey(today);
            const selectedStr = formatDateKey(selectedCalendarDate);
            
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateStr = formatDateKey(date);
                
                // Фильтруем задачи в соответствии с выбранными фильтрами
                const dayTasks = getFilteredTasksForDate(date);
                
                const dayDiv = document.createElement('div');
                dayDiv.className = 'calendar-day';
                if (dateStr === todayStr) {
                    dayDiv.classList.add('today');
                }
                if (dateStr === selectedStr) {
                    dayDiv.classList.add('selected');
                }
                
                // Проверка на просроченные задачи
                const hasOverdue = dayTasks.some(t => new Date(t.deadline) < new Date());
                const hasUrgent = dayTasks.some(t => {
                    if (t.completed) return false;
                    const urgency = calculateUrgency(t);
                    return urgency.urgent;
                });
                
                // Определяем цвет счетчика в зависимости от фильтра
                let countClass = '';
                if (calendarFilterType === 'urgent') countClass = 'urgent';
                else if (calendarFilterType === 'overdue') countClass = 'overdue';
                else if (calendarFilterType === 'completed') countClass = 'completed';
                else if (hasOverdue) countClass = 'overdue';
                else if (hasUrgent) countClass = 'urgent';
                
                // Кнопка добавления задачи
                const addBtn = \`<button class="calendar-add-btn" data-date="\${dateStr}" title="Добавить задачу">➕</button>\`;
                
                // Создаем превью задач (максимум 3)
                const previewTasks = dayTasks.slice(0, 3).map(t => {
                    const priority = t.priority || 'medium';
                    const isCompleted = t.completed ? '✅ ' : '📌 ';
                    return \`<div class="preview-task-item \${priority}" title="\${escapeHtml(t.title)}">\${isCompleted}\${escapeHtml(t.title)}</div>\`;
                }).join('');
                
                dayDiv.innerHTML = \`
                    <div class="day-header">
                        <span class="day-number">\${day}</span>
                        \${dayTasks.length > 0 ? \`<span class="day-tasks-count \${countClass}">\${dayTasks.length}</span>\` : ''}
                    </div>
                    \${addBtn}
                    <div class="day-tasks-preview">
                        \${previewTasks}
                        \${dayTasks.length > 3 ? '<div class="preview-task-item">...</div>' : ''}
                    </div>
                \`;
                
                // Обработчик клика по дню
                dayDiv.addEventListener('click', (e) => {
                    // Не обрабатываем клик, если кликнули на кнопку добавления
                    if (e.target.classList.contains('calendar-add-btn')) {
                        return;
                    }
                    selectCalendarDay(date);
                });
                
                // Обработчик для кнопки добавления
                const addBtnElement = dayDiv.querySelector('.calendar-add-btn');
                if (addBtnElement) {
                    addBtnElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        isFromCalendar = true;
                        openTaskModal(date);
                    });
                }
                
                fullscreenCalendarGrid.appendChild(dayDiv);
            }
            
            // Обновляем статистику календаря
            updateCalendarStats();
            
            // Обновляем список задач для выбранного дня
            updateSelectedDayTasks();
        }
        
        // Выбор дня в календаре
        function selectCalendarDay(date) {
            selectedCalendarDate = date;
            renderFullscreenCalendar();
            updateSelectedDayTasks();
        }
        
        // Обновление списка задач для выбранного дня
        function updateSelectedDayTasks() {
            const dateStr = formatDateKey(selectedCalendarDate);
            const dayTasks = getFilteredTasksForDate(selectedCalendarDate);
            
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            selectedDateTitle.textContent = selectedCalendarDate.toLocaleDateString('ru-RU', options);
            
            dayTasksList.innerHTML = '';
            
            if (dayTasks.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.cssText = 'text-align: center; padding: 60px 20px 20px 20px; color: #7F8C8D; width: 100%;';
                emptyDiv.innerHTML = 
                    '<div style="font-size: 48px; margin-bottom: 15px;">📭</div>' +
                    '<h3 style="font-size: 18px; margin-bottom: 8px; color: #7F8C8D;">Нет задач</h3>' +
                    '<p style="font-size: 14px; color: #95A5A6;">На этот день нет задач по выбранным фильтрам</p>';
                dayTasksList.appendChild(emptyDiv);
                return;
            }
            
            // Сортируем задачи по времени
            const sortedTasks = [...dayTasks].sort((a, b) => {
                return new Date(a.deadline) - new Date(b.deadline);
            });
            
            sortedTasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = 'day-task-card ' + (task.priority || 'medium') + (task.completed ? ' completed' : '');
                
                const taskTime = new Date(task.deadline);
                const timeStr = taskTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                
                // Определяем статус задачи
                let statusHtml = '';
                if (task.completed) {
                    statusHtml = '<div class="day-task-status status-completed">✅ Выполнено</div>';
                } else {
                    const urgency = calculateUrgency(task);
                    if (urgency.overdue) {
                        statusHtml = '<div class="day-task-status status-overdue">⏰ Просрочено</div>';
                    } else if (urgency.urgent) {
                        statusHtml = '<div class="day-task-status status-urgent">🔥 Горит</div>';
                    }
                }
                
                taskCard.innerHTML = 
                    '<div class="day-task-title">' + escapeHtml(task.title) + '</div>' +
                    '<div class="day-task-time">⏰ ' + timeStr + '</div>' +
                    statusHtml;
                
                taskCard.addEventListener('click', () => {
                    closeCalendar();
                    viewTask(task.id);
                });
                
                dayTasksList.appendChild(taskCard);
            });
        }
        
        // Установка текущей даты по умолчанию
        function setDefaultDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            document.getElementById('taskDate').value = \`\${year}-\${month}-\${day}\`;
        }
        
        // Загрузка задач из main процесса
        function loadTasks() {
            ipcRenderer.send('get-tasks');
        }
        
        ipcRenderer.on('tasks-loaded', (event, loadedTasks) => {
            tasks = loadedTasks;
            renderTasks();
            updateStatistics();
            if (calendarFullscreen.classList.contains('show')) {
                renderFullscreenCalendar();
            }
        });
        
        ipcRenderer.on('deleted-tasks-loaded', (event, loadedDeletedTasks) => {
            deletedTasks = loadedDeletedTasks;
            renderTasks();
            updateStatistics();
        });
        
        // Сохранение задач
        function saveTasksToFile() {
            ipcRenderer.send('save-tasks', tasks);
        }
        
        // Сохранение корзины
        function saveDeletedTasksToFile() {
            ipcRenderer.send('save-deleted-tasks', deletedTasks);
        }
        
        // Автообновление каждую минуту
        function startAutoUpdate() {
            setInterval(() => {
                renderTasks();
                updateStatistics();
                if (calendarFullscreen.classList.contains('show')) {
                    renderFullscreenCalendar();
                }
                checkNotifications();
            }, 60000);
        }
        
        // Проверка уведомлений
        function checkNotifications() {
            const now = new Date();
            
            tasks.forEach(task => {
                if (task.completed) return;
                
                const deadline = new Date(task.deadline);
                const diffHours = (deadline - now) / (1000 * 60 * 60);
                
                if (diffHours <= 24 && diffHours > 23.5) {
                    ipcRenderer.send('show-notification', {
                        title: '⏰ Дедлайн приближается!',
                        body: \`Задача "\${task.title}" через 24 часа\`
                    });
                }
                
                if (diffHours <= 1 && diffHours > 0.5) {
                    ipcRenderer.send('show-notification', {
                        title: '🔥 Срочно!',
                        body: \`Задача "\${task.title}" через \${Math.floor(diffHours)}ч \${Math.floor((diffHours - Math.floor(diffHours)) * 60)}м\`
                    });
                }
            });
        }
        
        // Отрисовка задач
        function renderTasks() {
            // Показываем/скрываем кнопку очистки корзины
            if (currentTab === 'deleted') {
                clearTrashContainer.style.display = 'flex';
            } else {
                clearTrashContainer.style.display = 'none';
            }
            
            let filteredTasks = [];
            
            switch (currentTab) {
                case 'active':
                    filteredTasks = tasks.filter(task => !task.completed);
                    break;
                case 'completed':
                    filteredTasks = tasks.filter(task => task.completed);
                    break;
                case 'urgent':
                    filteredTasks = tasks.filter(task => {
                        if (task.completed) return false;
                        const urgency = calculateUrgency(task);
                        return urgency.urgent;
                    });
                    break;
                case 'deleted':
                    filteredTasks = deletedTasks;
                    break;
                default:
                    filteredTasks = tasks.filter(task => !task.completed);
            }
            
            const sortedTasks = sortTasks(filteredTasks);
            
            if (sortedTasks.length === 0) {
                let emptyMessage = '';
                switch (currentTab) {
                    case 'active':
                        emptyMessage = 'Нет активных задач';
                        break;
                    case 'completed':
                        emptyMessage = 'Нет выполненных задач';
                        break;
                    case 'urgent':
                        emptyMessage = 'Нет горящих задач';
                        break;
                    case 'deleted':
                        emptyMessage = 'Корзина пуста';
                        break;
                }
                
                tasksList.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>\${emptyMessage}</h3>
                        <p>Нажмите "Новая задача", чтобы создать первую задачу</p>
                    </div>
                \`;
                return;
            }
            
            tasksList.innerHTML = '';
            
            sortedTasks.forEach(task => {
                const taskCard = createTaskCard(task);
                tasksList.appendChild(taskCard);
            });
        }
        
        // Создание карточки задачи
        function createTaskCard(task) {
            const urgency = calculateUrgency(task);
            const timeRemaining = formatTimeRemaining(task);
            
            // Определяем класс приоритета
            let priorityClass = 'priority-medium';
            if (task.priority === 'high') {
                priorityClass = 'priority-high';
            } else if (task.priority === 'low') {
                priorityClass = 'priority-low';
            }
            
            const overdueClass = urgency.overdue && !task.completed ? 'overdue' : '';
            const urgentClass = urgency.urgent && !task.completed ? 'urgent' : '';
            const deletedClass = currentTab === 'deleted' ? 'deleted' : '';
            
            const card = document.createElement('div');
            card.className = \`task-card \${priorityClass} \${overdueClass} \${urgentClass} \${deletedClass}\`;
            card.dataset.id = task.id;
            
            // Добавляем обработчик клика по карточке для просмотра
            card.addEventListener('click', (e) => {
                // Не открываем просмотр, если клик был по кнопке
                if (!e.target.closest('.task-action-btn')) {
                    viewTask(task.id);
                }
            });
            
            let descriptionHtml = '';
            if (task.description) {
                descriptionHtml = \`<div class="task-description">\${escapeHtml(task.description)}</div>\`;
            }
            
            let actionButtons = '';
            
            if (currentTab === 'deleted') {
                // Кнопки для удаленных задач
                actionButtons = \`
                    <button class="task-action-btn restore" data-action="restore" title="Восстановить">↩️</button>
                    <button class="task-action-btn permanent-delete" data-action="permanent-delete" title="Удалить навсегда">🗑️</button>
                \`;
            } else {
                // Кнопки для обычных задач
                const completeButton = !task.completed ? 
                    \`<button class="task-action-btn complete" data-action="complete" title="Выполнено">✓</button>\` : '';
                
                actionButtons = \`
                    \${completeButton}
                    <button class="task-action-btn edit" data-action="edit" title="Редактировать">✎</button>
                    <button class="task-action-btn delete" data-action="delete" title="Удалить">🗑</button>
                \`;
            }
            
            let deletedInfo = '';
            if (currentTab === 'deleted' && task.deletedAt) {
                const deletedDate = new Date(task.deletedAt);
                deletedInfo = \`<div class="deleted-info">Удалено: \${formatDate(task.deletedAt)}</div>\`;
            }
            
            card.innerHTML = \`
                <div class="task-card-header">
                    <h3 class="task-title" title="\${escapeHtml(task.title)}">\${escapeHtml(task.title)}</h3>
                    <div class="task-actions">
                        \${actionButtons}
                    </div>
                </div>
                \${descriptionHtml}
                <div class="task-footer">
                    <span class="task-deadline" title="\${formatDate(task.deadline)}">📅 \${formatDate(task.deadline)}</span>
                    \${currentTab !== 'deleted' ? \`<span class="task-time-remaining \${timeRemaining.class}" title="\${timeRemaining.text}">\${timeRemaining.text}</span>\` : ''}
                </div>
                \${deletedInfo}
            \`;
            
            // Добавляем обработчики для кнопок
            if (currentTab === 'deleted') {
                const restoreBtn = card.querySelector('[data-action="restore"]');
                const permanentDeleteBtn = card.querySelector('[data-action="permanent-delete"]');
                
                if (restoreBtn) {
                    restoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        restoreTask(task.id);
                    });
                }
                
                if (permanentDeleteBtn) {
                    permanentDeleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPermanentDeleteModal(task.id);
                    });
                }
            } else {
                const completeBtn = card.querySelector('[data-action="complete"]');
                const editBtn = card.querySelector('[data-action="edit"]');
                const deleteBtn = card.querySelector('[data-action="delete"]');
                
                if (completeBtn) {
                    completeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        completeTask(task.id);
                    });
                }
                
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        editTask(task.id);
                    });
                }
                
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openDeleteModal(task.id);
                    });
                }
            }
            
            return card;
        }
        
        // Просмотр задачи
        function viewTask(id) {
            let task = null;
            
            if (currentTab === 'deleted') {
                task = deletedTasks.find(t => t.id === id);
            } else {
                task = tasks.find(t => t.id === id);
            }
            
            if (!task) return;
            
            viewingTaskId = id;
            
            const urgency = calculateUrgency(task);
            const timeRemaining = formatTimeRemaining(task);
            
            let priorityBadgeClass = 'priority-medium-badge';
            let priorityText = 'Средний';
            
            if (task.priority === 'high') {
                priorityBadgeClass = 'priority-high-badge';
                priorityText = 'Высокий';
            } else if (task.priority === 'low') {
                priorityBadgeClass = 'priority-low-badge';
                priorityText = 'Низкий';
            }
            
            const content = document.getElementById('viewTaskContent');
            content.innerHTML = \`
                <div class="task-detail-title">\${escapeHtml(task.title)}</div>
                \${task.description ? \`<div class="task-detail-description">\${escapeHtml(task.description).replace(/\\n/g, '<br>')}</div>\` : ''}
                <div class="task-detail-meta">
                    <div class="task-detail-meta-item">
                        <span class="task-detail-meta-label">📅 Дедлайн:</span>
                        <span class="task-detail-meta-value">\${formatDate(task.deadline)}</span>
                    </div>
                    \${currentTab !== 'deleted' ? \`
                    <div class="task-detail-meta-item">
                        <span class="task-detail-meta-label">⏰ Осталось:</span>
                        <span class="task-detail-meta-value \${timeRemaining.class}" style="display: inline-block; padding: 2px 8px;">\${timeRemaining.text}</span>
                    </div>
                    \` : ''}
                    <div class="task-detail-meta-item">
                        <span class="task-detail-meta-label">🏷️ Приоритет:</span>
                        <span class="task-detail-meta-value">
                            <span class="task-detail-priority \${priorityBadgeClass}">\${priorityText}</span>
                        </span>
                    </div>
                    \${task.completed ? \`
                    <div class="task-detail-meta-item">
                        <span class="task-detail-meta-label">✅ Статус:</span>
                        <span class="task-detail-meta-value">Выполнено</span>
                    </div>
                    \` : ''}
                    \${task.deletedAt ? \`
                    <div class="task-detail-meta-item">
                        <span class="task-detail-meta-label">🗑️ Удалено:</span>
                        <span class="task-detail-meta-value">\${formatDate(task.deletedAt)}</span>
                    </div>
                    \` : ''}
                </div>
            \`;
            
            viewTaskModal.classList.add('show');
        }
        
        // Сортировка задач
        function sortTasks(tasksToSort) {
            const sortBy = sortSelect.value;
            
            return [...tasksToSort].sort((a, b) => {
                switch (sortBy) {
                    case 'date':
                        return new Date(a.deadline) - new Date(b.deadline);
                        
                    case 'priority': {
                        // Сортировка по приоритету (важности)
                        const priorityWeight = {
                            'high': 0,    // высокий - самый важный
                            'medium': 1,  // средний
                            'low': 2      // низкий
                        };
                        
                        const weightA = priorityWeight[a.priority] || 1;
                        const weightB = priorityWeight[b.priority] || 1;
                        
                        if (weightA !== weightB) {
                            return weightA - weightB; // сначала high, потом medium, потом low
                        }
                        
                        // Если одинаковый приоритет, сортируем по дате
                        return new Date(a.deadline) - new Date(b.deadline);
                    }
                    
                    case 'title':
                        return a.title.localeCompare(b.title);
                        
                    default:
                        return 0;
                }
            });
        }
        
        // Расчет срочности
        function calculateUrgency(task) {
            const now = new Date();
            const deadline = new Date(task.deadline);
            const diffMs = deadline - now;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            return {
                hours: diffHours,
                overdue: diffMs < 0,
                urgent: diffHours > 0 && diffHours < 24,
                warning: diffHours >= 24 && diffHours < 72
            };
        }
        
        // Форматирование оставшегося времени
        function formatTimeRemaining(task) {
            const urgency = calculateUrgency(task);
            
            if (urgency.overdue) {
                return { text: 'Просрочено!', class: 'time-urgent' };
            }
            if (urgency.urgent) {
                const hours = Math.floor(urgency.hours);
                const minutes = Math.floor((urgency.hours - hours) * 60);
                return { text: \`🔥 \${hours}ч \${minutes}м\`, class: 'time-urgent' };
            }
            if (urgency.warning) {
                const days = Math.floor(urgency.hours / 24);
                const hours = Math.floor(urgency.hours % 24);
                return { text: \`⏳ \${days}д \${hours}ч\`, class: 'time-warning' };
            }
            return { text: \`📅 \${Math.floor(urgency.hours / 24)}д\`, class: 'time-normal' };
        }
        
        // Форматирование даты
        function formatDate(dateString) {
            const date = new Date(dateString);
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return \`\${d}.\${m}.\${y} \${h}:\${min}\`;
        }
        
        // Форматирование даты для ключа (YYYY-MM-DD)
        function formatDateKey(date) {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return \`\${year}-\${month}-\${day}\`;
        }
        
        // Экранирование HTML
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Обновление статистики
        function updateStatistics() {
            document.getElementById('totalTasks').textContent = tasks.length;
            document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
            
            const urgent = tasks.filter(t => {
                if (t.completed) return false;
                const urgency = calculateUrgency(t);
                return urgency.urgent;
            }).length;
            
            const overdue = tasks.filter(t => {
                if (t.completed) return false;
                const urgency = calculateUrgency(t);
                return urgency.overdue;
            }).length;
            
            document.getElementById('urgentTasks').textContent = urgent;
            document.getElementById('overdueTasks').textContent = overdue;
            document.getElementById('deletedTasks').textContent = deletedTasks.length;
        }
        
        // Переключение табов
        function switchTab(tab, btn) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTasks();
        }
        
        // Открытие модалки для новой задачи
        function openTaskModal(selectedDate = null) {
            editingId = null;
            document.getElementById('modalTitle').textContent = '➕ Новая задача';
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDescription').value = '';
            
            const taskDateInput = document.getElementById('taskDate');
            
            if (selectedDate) {
                // Если передана конкретная дата (из календаря)
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                taskDateInput.value = year + '-' + month + '-' + day;
                // Блокируем изменение даты при создании из календаря
                taskDateInput.disabled = true;
            } else {
                // Если открыли с главной кнопки, ставим сегодня и дату можно менять
                setDefaultDate();
                taskDateInput.disabled = false;
            }
            
            document.getElementById('taskTime').value = '23:59';
            document.querySelector('input[name="priority"][value="medium"]').checked = true;
            taskModal.classList.add('show');
        }
        
        // Редактирование задачи
        function editTask(id) {
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            
            editingId = id;
            document.getElementById('modalTitle').textContent = '✏️ Редактирование задачи';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            
            const deadline = new Date(task.deadline);
            const year = deadline.getFullYear();
            const month = String(deadline.getMonth() + 1).padStart(2, '0');
            const day = String(deadline.getDate()).padStart(2, '0');
            const hours = String(deadline.getHours()).padStart(2, '0');
            const minutes = String(deadline.getMinutes()).padStart(2, '0');
            
            document.getElementById('taskDate').value = year + '-' + month + '-' + day;
            document.getElementById('taskDate').disabled = false; // При редактировании дату можно менять
            document.getElementById('taskTime').value = hours + ':' + minutes;
            
            const priority = task.priority || 'medium';
            document.querySelector('input[name="priority"][value="' + priority + '"]').checked = true;
            
            taskModal.classList.add('show');
        }
        
        // Сохранение задачи
        function saveTask() {
            const title = document.getElementById('taskTitle').value.trim();
            if (!title) {
                showNotification('Ошибка', 'Введите название задачи', 'error');
                return;
            }
            
            const date = document.getElementById('taskDate').value;
            const time = document.getElementById('taskTime').value;
            const deadline = new Date(date + 'T' + time);
            
            const priority = document.querySelector('input[name="priority"]:checked').value;
            
            if (editingId) {
                // Обновление существующей задачи
                const index = tasks.findIndex(t => t.id === editingId);
                if (index !== -1) {
                    tasks[index] = {
                        ...tasks[index],
                        title,
                        description: document.getElementById('taskDescription').value,
                        deadline: deadline.toISOString(),
                        priority
                    };
                    showNotification('Успех', 'Задача успешно обновлена', 'success', 3000);
                }
            } else {
                // Новая задача
                const newTask = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    title,
                    description: document.getElementById('taskDescription').value,
                    deadline: deadline.toISOString(),
                    priority,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                tasks.push(newTask);
                showNotification('Успех', 'Задача успешно создана', 'success', 3000);
            }
            
            saveTasksToFile();
            renderTasks();
            updateStatistics();
            if (calendarFullscreen.classList.contains('show')) {
                renderFullscreenCalendar();
            }
            closeModal();
        }
        
        // Отметка о выполнении
        function completeTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = true;
                saveTasksToFile();
                renderTasks();
                updateStatistics();
                showNotification('Успех', 'Задача "' + task.title + '" выполнена!', 'success', 3000);
                if (calendarFullscreen.classList.contains('show')) {
                    renderFullscreenCalendar();
                }
            }
        }
        
        // Открытие модалки удаления
        function openDeleteModal(id) {
            currentTaskId = id;
            deleteModal.classList.add('show');
        }
        
        // Подтверждение удаления (перемещение в корзину)
        function confirmDelete() {
            if (currentTaskId) {
                const taskIndex = tasks.findIndex(t => t.id === currentTaskId);
                if (taskIndex !== -1) {
                    const task = tasks[taskIndex];
                    const deletedTask = { ...task, deletedAt: new Date().toISOString() };
                    deletedTasks.unshift(deletedTask);
                    tasks.splice(taskIndex, 1);
                    
                    saveTasksToFile();
                    saveDeletedTasksToFile();
                    renderTasks();
                    updateStatistics();
                    showNotification('Инфо', 'Задача "' + task.title + '" перемещена в корзину', 'info', 3000);
                    if (calendarFullscreen.classList.contains('show')) {
                        renderFullscreenCalendar();
                    }
                }
                closeDeleteModal();
            }
        }
        
        // Открытие модалки полного удаления
        function openPermanentDeleteModal(id) {
            currentTaskId = id;
            permanentDeleteModal.classList.add('show');
        }
        
        // Подтверждение полного удаления
        function confirmPermanentDelete() {
            if (currentTaskId) {
                const task = deletedTasks.find(t => t.id === currentTaskId);
                if (task) {
                    deletedTasks = deletedTasks.filter(t => t.id !== currentTaskId);
                    saveDeletedTasksToFile();
                    renderTasks();
                    updateStatistics();
                    showNotification('Успех', 'Задача "' + task.title + '" полностью удалена', 'success', 3000);
                }
                closePermanentDeleteModal();
            }
        }
        
        // Восстановление задачи из корзины
        function restoreTask(id) {
            const taskIndex = deletedTasks.findIndex(t => t.id === id);
            if (taskIndex !== -1) {
                const task = deletedTasks[taskIndex];
                const restoredTask = { ...task };
                delete restoredTask.deletedAt;
                tasks.push(restoredTask);
                deletedTasks.splice(taskIndex, 1);
                
                saveTasksToFile();
                saveDeletedTasksToFile();
                renderTasks();
                updateStatistics();
                showNotification('Успех', 'Задача "' + task.title + '" восстановлена', 'success', 3000);
                if (calendarFullscreen.classList.contains('show')) {
                    renderFullscreenCalendar();
                }
            }
        }
        
        // Открытие модалки очистки корзины
        function openClearTrashModal() {
            clearTrashModal.classList.add('show');
        }
        
        // Подтверждение очистки корзины
        function confirmClearTrash() {
            const count = deletedTasks.length;
            deletedTasks = [];
            saveDeletedTasksToFile();
            renderTasks();
            updateStatistics();
            showNotification('Успех', 'Корзина очищена. Удалено ' + count + ' задач', 'success', 3000);
            closeClearTrashModal();
        }
        
        // Закрытие модалок
        function closeModal() {
            taskModal.classList.remove('show');
            // Сбрасываем disabled состояние для даты
            document.getElementById('taskDate').disabled = false;
            // Обновляем календарь, если он открыт
            if (calendarFullscreen.classList.contains('show')) {
                renderFullscreenCalendar();
            }
        }
        
        function closeViewModal() {
            viewTaskModal.classList.remove('show');
            viewingTaskId = null;
        }
        
        function closeDeleteModal() {
            deleteModal.classList.remove('show');
            currentTaskId = null;
        }
        
        function closePermanentDeleteModal() {
            permanentDeleteModal.classList.remove('show');
            currentTaskId = null;
        }
        
        function closeClearTrashModal() {
            clearTrashModal.classList.remove('show');
        }
    </script>
</body>
</html>
    `)}`);

    // Меню
    const template = [
        {
            label: 'Файл',
            submenu: [
                {
                    label: 'Новая задача',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.executeJavaScript('openTaskModal()');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Выход',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                {
                    label: 'Полноэкранный режим',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                {
                    label: 'Открыть календарь',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => {
                        mainWindow.webContents.executeJavaScript('openCalendar()');
                    }
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    // Обработчики IPC
    ipcMain.on('get-tasks', (event) => {
        loadTasks();
        event.reply('tasks-loaded', tasks);
        event.reply('deleted-tasks-loaded', deletedTasks);
    });

    ipcMain.on('save-tasks', (event, newTasks) => {
        tasks = newTasks;
        saveTasks();
    });

    ipcMain.on('save-deleted-tasks', (event, newDeletedTasks) => {
        deletedTasks = newDeletedTasks;
        saveDeletedTasks();
    });

    ipcMain.on('show-notification', (event, { title, body }) => {
        if (Notification.isSupported()) {
            new Notification({ title, body }).show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Добавляем обработчик для клавиши F11
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') {
            event.preventDefault();
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
    });
}

// Запуск приложения
app.whenReady().then(() => {
    loadTasks();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});