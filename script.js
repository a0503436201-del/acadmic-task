// --- משתנים גלובליים ---
const tasksListEdit = document.getElementById('tasks-list-edit');
const tasksListView = document.getElementById('tasks-list-view');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const addTaskBtn = document.getElementById('add-task-btn'); 
const viewMode = document.getElementById('view-mode');
const editMode = document.getElementById('edit-mode');
const taskForm = document.getElementById('task-form');
const saveTaskBtn = document.getElementById('save-task-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const statusBar = document.getElementById('completed-bar');
const statusBarText = document.getElementById('status-bar-text');

// רכיבים לניהול התקדמות מקצועות (במצב עריכה)
const subjectProgressForm = document.getElementById('subject-progress-form');
const progressSubjectInput = document.getElementById('progress-subject');
const progressValueInput = document.getElementById('progress-value');
const subjectListDatalist = document.getElementById('subject-list');


let tasks = []; // מערך המטלות
let subjectsProgress = {}; // אובייקט לשמירת התקדמות מקצועות { "מקצוע": 50 }
let isEditMode = false;

// --- פונקציות עזר: שמירת נתונים ---

/** טוען מטלות והתקדמות מקצועות מהאחסון המקומי (LocalStorage) */
function loadTasksAndProgress() {
    const storedTasks = localStorage.getItem('academicTasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
    }
    const storedProgress = localStorage.getItem('subjectsProgress');
    if (storedProgress) {
        subjectsProgress = JSON.parse(storedProgress);
    }
}

/** שומר את מערך המטלות והתקדמות המקצועות לאחסון המקומי */
function saveTasksAndProgress() {
    localStorage.setItem('academicTasks', JSON.stringify(tasks));
    localStorage.setItem('subjectsProgress', JSON.stringify(subjectsProgress));
}

/** מחשב את ההפרש בימים */
function getDaysDifference(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const dueDate = new Date(dateString);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/** ממיר ערך התקדמות (כמו "חצי" או "1/3") לאחוז (0-100) */
function parseProgressValue(value) {
    value = String(value).trim().toLowerCase().replace(' ', '');
    
    // בדיקת אחוזים (מספרי)
    const percentage = parseInt(value.replace('%', ''));
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        return percentage;
    }

    // בדיקת שברים
    if (value.includes('/')) {
        const parts = value.split('/').map(p => parseInt(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
            return Math.min(100, Math.round((parts[0] / parts[1]) * 100)); 
        }
    }

    // בדיקת מילים (ברירת מחדל: 0)
    switch (value) {
        case 'חצי':
        case '1/2':
            return 50;
        case 'שליש':
        case '1/3':
            return 33;
        case 'רבע':
        case '1/4':
            return 25;
        case 'שנישליש':
        case '2/3':
            return 66;
        case 'שלושרבע':
        case '3/4':
            return 75;
        case 'מלא':
        case 'בוצע':
        case '100':
            return 100;
        default:
            return 0; // ברירת מחדל
    }
}


// --- פונקציות לוגיקה חדשות/מעודכנות ---

/** טיפול בעדכון התקדמות מקצוע מהקלט במצב צפייה */
function handleProgressChange(subject, inputElement) {
    const value = inputElement.value.trim();
    const progressPercentage = parseProgressValue(value);

    subjectsProgress[subject] = progressPercentage;
    saveTasksAndProgress();
    
    // עדכון מיידי של התצוגה במצב צפייה
    const container = inputElement.closest('.subject-progress-display');
    // מצא את פס ההתקדמות שנמצא אחרי הכותרת
    const progressBarContainer = container.nextElementSibling; 
    const progressFill = progressBarContainer.querySelector('.subject-progress-fill');
    const progressText = container.querySelector('.progress-text');

    progressFill.style.width = `${progressPercentage}%`;
    progressText.textContent = `${progressPercentage}%`;
    inputElement.value = progressPercentage; // מציג את האחוז לאחר הפיכת השבר/מילה

    // הסרת הפוקוס מהשדה
    inputElement.blur(); 
}


// --- פונקציות רענון התצוגה ---

/** מעדכן את פס הסטטוס הכללי */
function updateStatusBar() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isDone).length;
    const pendingTasks = totalTasks - completedTasks;

    if (totalTasks === 0) {
        statusBar.style.width = '0%';
        statusBarText.textContent = 'אין מטלות להצגה.';
        return;
    }

    const completionPercentage = (completedTasks / totalTasks) * 100;
    statusBar.style.width = `${completionPercentage}%`;
    statusBarText.textContent = `סטטוס הגשות כללי: ${completedTasks} בוצעו מתוך ${totalTasks} (${Math.round(completionPercentage)}%). ${pendingTasks} ממתינות.`;
}

/** מעדכן את רשימת ההצעות למקצועות בטופס העריכה */
function updateSubjectDatalist() {
    const uniqueSubjects = [...new Set(tasks.map(t => t.subject).filter(s => s))];
    subjectListDatalist.innerHTML = uniqueSubjects.map(subject => 
        `<option value="${subject}">`
    ).join('');
}


/** מרנדר (מציג) את המטלות במצב צפייה */
function renderTasksView() {
    // ממיין מטלות לפי תאריך הגשה (הקרוב ביותר ראשון)
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    tasksListView.innerHTML = '';
    
    // קיבוץ המטלות לפי מקצוע
    const groupedTasks = sortedTasks.reduce((acc, task) => {
        if (!acc[task.subject]) {
            acc[task.subject] = [];
        }
        acc[task.subject].push(task);
        return acc;
    }, {});
    
    // יצירת רשימה על פי מקצועות
    for (const subject in groupedTasks) {
        const progress = subjectsProgress[subject] || 0; 
        
        // --- הצגת כותרת עם קלט התקדמות מקצוע ---
        const progressHeader = document.createElement('div');
        progressHeader.className = 'subject-progress-display';
        progressHeader.innerHTML = `
            <div class="progress-header">
                <strong>${subject}</strong> - התקדמות: 
                <span class="progress-text">${progress}%</span>
            </div>
            <input type="text" 
                   class="progress-input-view" 
                   placeholder="${progress}%" 
                   value="${progress}" 
                   data-subject="${subject}"
                   title="עדכן התקדמות (למשל: 50, חצי, 1/3)">
        `;
        tasksListView.appendChild(progressHeader);

        // --- הצגת פס ההתקדמות ---
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'subject-progress-bar-container';
        progressBarContainer.innerHTML = `
            <div class="subject-progress-bar">
                <div class="subject-progress-fill" style="width: ${progress}%;"></div>
            </div>
        `;
        tasksListView.appendChild(progressBarContainer);
        
        
        // --- הצגת המטלות השייכות למקצוע זה ---
        groupedTasks[subject].forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id; 
            li.className = 'task-item';

            const daysDiff = getDaysDifference(task.dueDate);

            // הוספת קלאסים לעיצוב מותנה
            if (task.isDone) {
                li.classList.add('task-done');
            } else if (daysDiff >= 0 && daysDiff <= 2) {
                li.classList.add('due-soon');
            } else if (daysDiff < 0) {
                li.classList.add('overdue');
            }

            const dateText = new Date(task.dueDate).toLocaleDateString('he-IL');
            let dueStatusText = `| מועד הגשה: ${dateText}`;

            if (!task.isDone) {
                if (daysDiff === 0) dueStatusText = `| **להיום!** ⚠️`;
                else if (daysDiff === 1) dueStatusText = `| **מחר!** ⚠️`;
                else if (daysDiff > 1) dueStatusText = `| נותרו ${daysDiff} ימים.`;
                else dueStatusText = `| **פג תוקף** לפני ${Math.abs(daysDiff)} ימים ⛔`;
            }

            li.innerHTML = `
                <div class="task-info">
                    <strong>${task.subject}</strong>: ${task.name}
                </div>
                <div class="task-due-date">
                    ${dueStatusText}
                </div>
                <label>
                    <input type="checkbox" ${task.isDone ? 'checked' : ''} onchange="toggleTaskDone('${task.id}')">
                    בוצע
                </label>
            `;
            tasksListView.appendChild(li);
        });
    }

    // הוספת Event Listeners לקלטי ההתקדמות החדשים במצב צפייה
    tasksListView.querySelectorAll('.progress-input-view').forEach(input => {
        // שינוי בפוקוס החוצה (change) או לחיצה על Enter (keydown)
        input.addEventListener('change', (e) => {
            const subject = e.target.dataset.subject;
            handleProgressChange(subject, e.target);
        });
        input.addEventListener('keydown', (e) => {
             if (e.key === 'Enter') {
                 e.preventDefault();
                 const subject = e.target.dataset.subject;
                 handleProgressChange(subject, e.target);
             }
         });
    });

    updateStatusBar();
    renderTasksEdit(); 
    updateSubjectDatalist(); 
}

/** מרנדר את המטלות במצב עריכה */
function renderTasksEdit() {
    tasksListEdit.innerHTML = '';
    
    tasks.forEach(task => {
        const li = document.createElement('li');
        
        li.innerHTML = `
            <div class="task-info">
                ${task.subject}: ${task.name} (תאריך: ${new Date(task.dueDate).toLocaleDateString('he-IL')})
            </div>
            <div class="edit-actions">
                <button class="edit-btn" onclick="editTask('${task.id}')">ערוך</button>
                <button class="delete-btn" onclick="deleteTask('${task.id}')">מחק</button>
            </div>
        `;
        tasksListEdit.appendChild(li);
    });
}


// --- לוגיקת מצבים ואירועים ---

/** טיפול בשינוי מצב (צפייה/עריכה) וניקוי טופס המטלות */
function setEditMode(enable) {
    isEditMode = enable;
    if (isEditMode) {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
        toggleModeBtn.textContent = 'מעבר למצב צפייה';
        // איפוס טופס המטלות למצב 'הוספה'
        taskForm.reset(); 
        document.getElementById('task-id').value = '';
        saveTaskBtn.textContent = 'שמור מטלה';
        cancelEditBtn.style.display = 'none';
    } else {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        toggleModeBtn.textContent = 'מעבר למצב עריכה';
    }
}

// מעבר מצבים באמצעות כפתור הראשי
toggleModeBtn.addEventListener('click', () => {
    setEditMode(!isEditMode);
});

// כפתור הוספת מטלה במצב צפייה
addTaskBtn.addEventListener('click', () => {
    setEditMode(true);
});


/** הוספת/עדכון מטלה דרך הטופס (מצב עריכה) */
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('task-id').value;
    const subject = document.getElementById('subject').value.trim();
    const name = document.getElementById('task-name').value.trim();
    const dueDate = document.getElementById('due-date').value;
    const isDone = document.getElementById('is-done-edit').checked;

    if (!subject || !name || !dueDate) return;

    if (id) {
        // מצב עדכון
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasks[taskIndex] = { id, subject, name, dueDate, isDone };
        }
    } else {
        // מצב הוספה
        const newTask = {
            id: Date.now().toString(), 
            subject,
            name,
            dueDate,
            isDone
        };
        tasks.push(newTask);
    }
    
    saveTasksAndProgress(); 
    renderTasksView(); 
    taskForm.reset();
    document.getElementById('task-id').value = ''; 
    saveTaskBtn.textContent = 'שמור מטלה';
    cancelEditBtn.style.display = 'none';
});

/** טיפול בטופס עדכון התקדמות מקצוע (מצב עריכה) */
subjectProgressForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const subject = progressSubjectInput.value.trim();
    const value = progressValueInput.value.trim();
    const messageDiv = document.getElementById('progress-message');

    if (!subject || !value) {
        messageDiv.textContent = 'אנא מלא את שם המקצוע וערך ההתקדמות.';
        messageDiv.style.color = 'red';
        setTimeout(() => { messageDiv.textContent = ''; }, 3000);
        return;
    }

    const progressPercentage = parseProgressValue(value);
    
    subjectsProgress[subject] = progressPercentage;

    saveTasksAndProgress(); 
    renderTasksView(); 
    subjectProgressForm.reset();
    messageDiv.textContent = `התקדמות המקצוע "${subject}" עודכנה ל-${progressPercentage}% בהצלחה!`;
    messageDiv.style.color = 'green';

    // ניקוי הודעה לאחר 3 שניות
    setTimeout(() => { messageDiv.textContent = ''; }, 3000);
});


/** מחיקת מטלה */
function deleteTask(id) {
    if (confirm('האם אתה בטוח שברצונך למחוק מטלה זו?')) {
        tasks = tasks.filter(task => task.id !== id);
        saveTasksAndProgress(); 
        renderTasksView();
        
        if (document.getElementById('task-id').value === id) {
             taskForm.reset();
             document.getElementById('task-id').value = '';
             saveTaskBtn.textContent = 'שמור מטלה';
             cancelEditBtn.style.display = 'none';
        }
    }
}

/** הכנת הטופס לעריכת מטלה */
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('task-id').value = task.id;
        document.getElementById('subject').value = task.subject;
        document.getElementById('task-name').value = task.name;
        document.getElementById('due-date').value = task.dueDate;
        document.getElementById('is-done-edit').checked = task.isDone;
        
        saveTaskBtn.textContent = 'עדכן מטלה';
        cancelEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
}

/** ביטול עריכה וניקוי הטופס */
cancelEditBtn.addEventListener('click', () => {
    taskForm.reset();
    document.getElementById('task-id').value = '';
    saveTaskBtn.textContent = 'שמור מטלה';
    cancelEditBtn.style.display = 'none';
});

/** שינוי סטטוס בוצע/לא בוצע ממצב צפייה */
function toggleTaskDone(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.isDone = !task.isDone;
        saveTasksAndProgress(); 
        renderTasksView();
    }
}

// --- אתחול האפליקציה ---
document.addEventListener('DOMContentLoaded', () => {
    loadTasksAndProgress(); 
    renderTasksView(); 
});