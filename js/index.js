"use strict";
/**
 * index.js
 * -----------------------------------------------------------------------
 * ده نسخة "مجمّعة" (Bundled) من نفس الكود اللي كان مقسّم على 4 ملفات
 * TypeScript (types.ts, storage.ts, dragDrop.ts, app.ts).
 *
 * ليه عملنا النسخة دي؟
 * لأن ملفات الـ ES Modules (اللي فيها import/export) مايقدروش يتفتحوا
 * من المتصفح مباشرة لما تعمل لها double-click (file://) - المتصفح
 * بيرفضها لأسباب أمنية ولازم سيرفر محلي (Live Server). النسخة دي
 * عادية 100%، بدون import/export، فتشتغل فور ما تفتح index.html
 * بنقرة واحدة على أي جهاز.
 *
 * ملحوظة: المنطق والتعليقات نفسها زي ملفات TS الأصلية، بس هنا في
 * ملف واحد. لو حبيت ترجع للنسخة المقسّمة (TypeScript) قولّي.
 * -----------------------------------------------------------------------
 */
(function () {
    "use strict";
    /* =====================================================================
       1) STORAGE - التعامل مع localStorage
       ===================================================================== */
    const STORAGE_KEY = "kanban_tasks";
    /** يرجع كل التاسكات المخزنة، أو مصفوفة فاضية لو مفيش حاجة محفوظة */
    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return [];
            }
            return JSON.parse(raw);
        }
        catch (error) {
            console.error("فشل تحميل التاسكات من localStorage:", error);
            return [];
        }
    }
    /** يحفظ مصفوفة التاسكات كاملة في localStorage */
    function saveTasks(tasks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        }
        catch (error) {
            console.error("فشل حفظ التاسكات في localStorage:", error);
        }
    }
    /* =====================================================================
       2) DRAG & DROP - منطق السحب والإفراج (HTML5 Drag API الأصلية)
       ===================================================================== */
    /** يضيف خاصية "قابل للسحب" على عنصر الكارت */
    function makeDraggable(cardElement, taskId) {
        cardElement.draggable = true;
        cardElement.addEventListener("dragstart", function (event) {
            if (event.dataTransfer) {
                event.dataTransfer.setData("text/plain", taskId);
                event.dataTransfer.effectAllowed = "move";
            }
            cardElement.classList.add("opacity-50");
        });
        cardElement.addEventListener("dragend", function () {
            cardElement.classList.remove("opacity-50");
        });
    }
    /** يحوّل عنصر عمود (Column) لمنطقة "ممكن يستقبل" كروت متسحبة */
    function makeDroppable(columnElement, targetStatus, onDrop) {
        columnElement.addEventListener("dragover", function (event) {
            event.preventDefault();
            columnElement.classList.add("bg-[#EEF2FF]");
        });
        columnElement.addEventListener("dragleave", function () {
            columnElement.classList.remove("bg-[#EEF2FF]");
        });
        columnElement.addEventListener("drop", function (event) {
            event.preventDefault();
            columnElement.classList.remove("bg-[#EEF2FF]");
            const taskId = event.dataTransfer
                ? event.dataTransfer.getData("text/plain")
                : null;
            if (taskId) {
                onDrop(taskId, targetStatus);
            }
        });
    }
    /* =====================================================================
       3) APP - الكلاس الرئيسي اللي يجمع كل حاجة
       ===================================================================== */
    const COLUMNS = [
        {
            status: "todo",
            title: "To Do",
            containerId: "todo-list",
            countId: "todo-count",
        },
        {
            status: "in-progress",
            title: "In Progress",
            containerId: "in-progress-list",
            countId: "in-progress-count",
        },
        {
            status: "completed",
            title: "Completed",
            containerId: "completed-list",
            countId: "completed-count",
        },
    ];
    const PRIORITY_STYLES = {
      low: {
        label: "Low",
        classes: "bg-[#ECFDF5] text-[#00BC7D]",
        dot: "bg-[#00BC7D]",
      },
      medium: {
        label: "Medium",
        classes: "bg-[#FFFBEB] text-[#FE9A00]",
        dot: "bg-[#FE9A00]",
      },
      high: {
        label: "High",
        classes: "bg-[#FEF2F2] text-[#EF4444]",
        dot: "bg-[#EF4444]",
      },
    };
    /** ألوان نقطة الحالة (الدائرة الصغيرة جنب رقم التاسك #001) حسب العمود الحالي */
    const STATUS_DOT_COLORS = {
        todo: "bg-[#C5CEDB]",
        "in-progress": "bg-[#FE9A00]",
        completed: "bg-[#00BC7D]",
    };
    function KanbanBoard() {
        // نحمّل أي تاسكات محفوظة سابقاً من localStorage فور بدء التطبيق
        this.tasks = loadTasks();
        this.modal = document.getElementById("task-modal");
        this.form = document.getElementById("task-form");
        this.descriptionInput = document.getElementById("task-description");
        this.charCounter = document.getElementById("char-counter");
        this.bindStaticEvents();
        this.setupDropZones();
        this.render();
        // نعمل re-render تلقائي كل دقيقة عشان نص "Just now" / "5m ago" يفضل دقيق
        // من غير ما المستخدم يحتاج يضيف أو يحذف أي تاسك عشان يتحدث.
        const self = this;
        setInterval(function () {
            self.render();
        }, 60 * 1000);
    }
    /** يربط الأحداث الثابتة: زرار الإضافة، الإلغاء، إغلاق المودال، تقديم الفورم */
    KanbanBoard.prototype.bindStaticEvents = function () {
        const self = this;
        const openButton = document.getElementById("open-modal-btn");
        const closeButton = document.getElementById("close-modal-btn");
        const cancelButton = document.getElementById("cancel-btn");
        if (openButton) {
            openButton.addEventListener("click", function () {
                self.openModal();
            });
        }
        if (closeButton) {
            closeButton.addEventListener("click", function () {
                self.closeModal();
            });
        }
        if (cancelButton) {
            cancelButton.addEventListener("click", function () {
                self.closeModal();
            });
        }
        if (this.modal) {
            this.modal.addEventListener("click", function (event) {
                if (event.target === self.modal) {
                    self.closeModal();
                }
            });
        }
        if (this.descriptionInput) {
            this.descriptionInput.addEventListener("input", function () {
                self.updateCharCounter();
            });
        }
        if (this.form) {
            this.form.addEventListener("submit", function (event) {
                event.preventDefault();
                self.handleFormSubmit();
            });
        }
    };
    /** يحدّث نص عداد الحروف تحت خانة الوصف */
    KanbanBoard.prototype.updateCharCounter = function () {
        if (!this.descriptionInput || !this.charCounter)
            return;
        const length = this.descriptionInput.value.length;
        this.charCounter.textContent = length + "/500";
    };
    /** يفتح المودال ويفضي الفورم */
    KanbanBoard.prototype.openModal = function () {
        if (this.form)
            this.form.reset();
        this.updateCharCounter();
        if (this.modal) { this.modal.style.display = "flex"; }
    };
    /** يقفل المودال */
    KanbanBoard.prototype.closeModal = function () {
        if (this.modal) { this.modal.style.display = "none"; }
    };
    /** يقرا بيانات الفورم، يبني تاسك جديد، يضيفه، يحفظه، يعمل render */
    KanbanBoard.prototype.handleFormSubmit = function () {
        if (!this.form)
            return;
        const formData = new FormData(this.form);
        const title = (formData.get("title") || "").toString().trim();
        const priority = (formData.get("priority") || "low").toString();
        const dueDate = (formData.get("dueDate") || "").toString();
        const description = (formData.get("description") || "").toString();
        if (title.length === 0) {
            alert("من فضلك اكتب عنوان التاسك");
            return;
        }
        this.addTask({
            title: title,
            priority: priority,
            dueDate: dueDate,
            description: description,
        });
        this.closeModal();
    };
    /** يبني تاسك كامل من بيانات الفورم ويضيفه لمصفوفة التاسكات */
    KanbanBoard.prototype.addTask = function (input) {
        const newTask = {
            title: input.title,
            priority: input.priority,
            dueDate: input.dueDate,
            description: input.description,
            id: this.generateId(),
            status: "todo",
            createdAt: Date.now(),
        };
        this.tasks.push(newTask);
        this.persistAndRender();
    };
    /** يمسح تاسك بمعرفه (id) */
    KanbanBoard.prototype.deleteTask = function (taskId) {
        this.tasks = this.tasks.filter(function (task) {
            return task.id !== taskId;
        });
        this.persistAndRender();
    };
    /** يغيّر حالة (status) تاسك معين - يستخدمها الـ Drag & Drop */
    KanbanBoard.prototype.moveTask = function (taskId, newStatus) {
        const task = this.tasks.find(function (task) {
            return task.id === taskId;
        });
        if (task) {
            task.status = newStatus;
            this.persistAndRender();
        }
    };
    /**
     * بينقل التاسك لحالة محددة عن طريق زراري Start/Complete (بدل السحب).
     * نفس منطق moveTask بالضبط، بس بنسميها باسم منفصل عشان توضيح القصد
     * وقت القراءة: "advance" = تقدّم التاسك للأمام في سير العمل.
     */
    KanbanBoard.prototype.advanceTask = function (taskId, newStatus) {
        this.moveTask(taskId, newStatus);
    };
    /** يولّد id فريد بسيط */
    KanbanBoard.prototype.generateId = function () {
        return "task-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    };
    /**
     * يحسب الرقم التسلسلي لتاسك معين بناءً على ترتيب إنشائه بين كل
     * التاسكات (الأقدم #001، اللي بعده #002، وهكذا) - بيتحسب وقت الـ
     * render مش بيتخزن، عشان لو تاسك اتمسح الترقيم يفضل متسلسل صحيح.
     */
    KanbanBoard.prototype.getTaskSequenceNumber = function (taskId) {
        // بنرتب نسخة من التاسكات حسب createdAt تصاعدياً عشان نحدد ترتيب كل تاسك
        const sorted = this.tasks.slice().sort(function (a, b) {
            return a.createdAt - b.createdAt;
        });
        const index = sorted.findIndex(function (task) {
            return task.id === taskId;
        });
        const number = index + 1;
        // padStart بيضمن شكل #001 بدل #1
        return "#" + String(number).padStart(3, "0");
    };
    /**
     * يحوّل timestamp لنص "وقت نسبي" بشكل بسيط (Just now, 5m ago, 2h ago...)
     * زي ما هو ظاهر في تصميم الكارت المطلوب.
     */
    KanbanBoard.prototype.getRelativeTime = function (timestamp) {
        const diffMs = Date.now() - timestamp;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffSeconds < 60) {
            return "Just now";
        }
        if (diffMinutes < 60) {
            return diffMinutes + "m ago";
        }
        if (diffHours < 24) {
            return diffHours + "h ago";
        }
        return diffDays + "d ago";
    };
    /** يحفظ التاسكات في localStorage ثم يعيد رسم الواجهة */
    KanbanBoard.prototype.persistAndRender = function () {
        saveTasks(this.tasks);
        this.render();
    };
    /** يجهّز كل عمود كمنطقة "drop" - مرة واحدة بس عند بدء التطبيق */
    KanbanBoard.prototype.setupDropZones = function () {
        const self = this;
        COLUMNS.forEach(function (column) {
            const container = document.getElementById(column.containerId);
            if (container) {
                makeDroppable(container, column.status, function (taskId, newStatus) {
                    self.moveTask(taskId, newStatus);
                });
            }
        });
    };
    /** يعيد رسم الواجهة بالكامل من مصفوفة this.tasks الحالية */
    KanbanBoard.prototype.render = function () {
        const self = this;
        COLUMNS.forEach(function (column) {
            const container = document.getElementById(column.containerId);
            const countElement = document.getElementById(column.countId);
            if (!container || !countElement)
                return;
            const columnTasks = self.tasks.filter(function (task) {
                return task.status === column.status;
            });
            countElement.textContent = columnTasks.length + " tasks";
            if (columnTasks.length === 0) {
                container.innerHTML = self.renderEmptyState();
                return;
            }
            container.innerHTML = columnTasks
                .map(function (task) {
                return self.renderTaskCard(task);
            })
                .join("");
            // بعد ما الـ HTML اتضاف للـ DOM، نربط draggable + زرار الحذف لكل كارت
            columnTasks.forEach(function (task) {
                const cardElement = document.getElementById("card-" + task.id);
                if (cardElement) {
                    makeDraggable(cardElement, task.id);
                    const deleteBtn = cardElement.querySelector(".delete-task-btn");
                    if (deleteBtn) {
                        deleteBtn.addEventListener("click", function (event) {
                            event.stopPropagation();
                            self.deleteTask(task.id);
                        });
                    }
                    // زرار "Start" - يظهر بس في عمود To Do، وينقل التاسك لـ In Progress
                    const startBtn = cardElement.querySelector(".start-task-btn");
                    if (startBtn) {
                        startBtn.addEventListener("click", function (event) {
                            event.stopPropagation();
                            self.advanceTask(task.id, "in-progress");
                        });
                    }
                    // زرار Complete
                    const completeBtn = cardElement.querySelector(".complete-task-btn");
                    if (completeBtn) {
                        completeBtn.addEventListener("click", function (event) {
                            event.stopPropagation();
                            self.advanceTask(task.id, "completed");
                        });
                    }
                    // زرار To Do
                    const todoBtn = cardElement.querySelector(".todo-task-btn");
                    if (todoBtn) {
                        todoBtn.addEventListener("click", function (event) {
                            event.stopPropagation();
                            self.advanceTask(task.id, "todo");
                        });
                    }
                }
            });
        });
    };
    /** يولّد الـ HTML الخاص بحالة "العمود فاضي" */
    KanbanBoard.prototype.renderEmptyState = function () {
        return ('<div class="py-16 flex flex-col justify-center items-center">' +
            '<i class="fa-solid fa-folder-open text-4xl" style="color: rgb(197, 206, 219)"></i>' +
            '<span class="text-[14px] font-medium text-[#90a1b9]">No tasks yet</span>' +
            '<span class="text-[14px] font-medium text-[#90a1b9]">Click + to add one</span>' +
            "</div>");
    };
    /** يولّد الـ HTML الخاص بكارت تاسك واحد - بالتصميم الجديد (رقم تسلسلي، نقطة حالة، وقت نسبي، زرارات Start/Complete) */
    KanbanBoard.prototype.renderTaskCard = function (task) {
        const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.low;
        const statusDotColor = STATUS_DOT_COLORS[task.status] || STATUS_DOT_COLORS.todo;
        const safeTitle = this.escapeHtml(task.title);
        const safeDescription = task.description
            ? this.escapeHtml(task.description)
            : "";
        const sequenceNumber = this.getTaskSequenceNumber(task.id);
        const relativeTime = this.getRelativeTime(task.createdAt);
        // زرارات الأكشن - inline styles عشان نتحكم في الألوان بدقة
        const baseBtn = "display:flex; align-items:center; justify-content:center; gap:8px; padding:11px 14px; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; flex:1;";

        // Start - أصفر
        const btnStart =
            "<button class=\"start-task-btn\"" +
            " style=\"" + baseBtn + " background:#FEF3C6; color:#D97706;\"" +
            " onmouseover=\"this.style.background='#FEE685';\"" +
            " onmouseout=\"this.style.background='#FEF3C6';\">" +
            "<i class=\"fa-solid fa-play\" style=\"font-size:11px; color:#BB4D00;\"></i> Start" +
            "</button>";

        // Complete - أخضر
        const btnComplete =
            "<button class=\"complete-task-btn\"" +
            " style=\"" + baseBtn + " background:#D1FAE5; color:#059669;\"" +
            " onmouseover=\"this.style.background='#A7F3D0';\"" +
            " onmouseout=\"this.style.background='#D1FAE5';\">" +
            "<i class=\"fa-solid fa-check\" style=\"font-size:11px; color:#047857;\"></i> Complete" +
            "</button>";

        // To Do - رمادي
        const btnTodo =
            "<button class=\"todo-task-btn\"" +
            " style=\"" + baseBtn + " background:#E2E8F0; color:#475569;\"" +
            " onmouseover=\"this.style.background='#CBD5E1';\"" +
            " onmouseout=\"this.style.background='#E2E8F0';\">" +
            "<i class=\"fa-solid fa-rotate-left\" style=\"font-size:11px; color:#334155;\"></i> To Do" +
            "</button>";

        let actionButtonsHtml = "";
        if (task.status === "todo") {
            actionButtonsHtml = btnStart + btnComplete;
        }
        else if (task.status === "in-progress") {
            actionButtonsHtml = btnTodo + btnComplete;
        }
        else if (task.status === "completed") {
            actionButtonsHtml = btnTodo + btnStart;
        }
        return ('<div id="card-' +
            task.id +
            '" class="bg-white rounded-xl p-4 mb-3 border border-[#E9EBEE] shadow-sm cursor-grab transition-opacity mt-5">' +
            // السطر الأول: نقطة الحالة + رقم التاسك التسلسلي + زرار الحذف
            '<div class="flex justify-between items-center">' +
            '<div class="flex items-center gap-2">' +
            '<span class="w-2 h-2 rounded-full ' +
            statusDotColor +
            '"></span>' +
            '<span class="text-[12px] font-medium text-[#90a1b9]">' +
            sequenceNumber +
            "</span>" +
            "</div>" +
            '<button class="delete-task-btn text-[#C5CEDB] hover:text-red-500 transition-colors" title="حذف التاسك">' +
            '<i class="fa-solid fa-trash text-sm"></i>' +
            "</button>" +
            "</div>" +
            // العنوان
            '<h4 class="text-[16px] font-bold text-[#1d293d] mt-3">' +
            safeTitle +
            "</h4>" +
            // الوصف (يظهر بس لو موجود)
            (safeDescription
                ? '<p class="text-[13px] text-[#62748E] mt-1">' +
                    safeDescription +
                    "</p>"
                : "") +
            // شارة الأولوية (مع نقطة لونية قبل النص)
            '<div class="mt-3">' +
            '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ' +
            priorityStyle.classes +
            '">' +
            '<span class="w-1.5 h-1.5 rounded-full ' +
            priorityStyle.dot +
            '"></span>' +
            priorityStyle.label +
            "</span>" +
            "</div>" +
            // الوقت النسبي مع أيقونة ساعة
            '<div class="flex items-center gap-1.5 text-[12px] text-[#90a1b9] mt-3">' +
            '<i class="fa-regular fa-clock"></i>' +
            "<span>" +
            relativeTime +
            "</span>" +
            "</div>" +
            // خط فاصل
            '<hr class="border-[#E9EBEE] mt-3" />' +
            // زرارات الأكشن (Start / Complete) - تظهر بس لو فيه أكشن متاح للحالة الحالية
            (actionButtonsHtml
                ? '<div class="flex gap-2 mt-3">' + actionButtonsHtml + "</div>"
                : "") +
            "</div>");
    };
    /** يحوّل أي نص لـ HTML آمن، عشان نمنع حقن أكواد ضارة عبر عناوين التاسكات */
    KanbanBoard.prototype.escapeHtml = function (text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    };
    /* =====================================================================
       4) التشغيل - نبدأ التطبيق فقط بعد ما الـ DOM يكون جاهز بالكامل
       ===================================================================== */
    document.addEventListener("DOMContentLoaded", function () {
        new KanbanBoard();
    });
})();
