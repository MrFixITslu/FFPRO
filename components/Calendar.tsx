
import React, { useState, useMemo } from 'react';
import { BudgetEvent, Transaction, RecurringExpense, RecurringIncome, ProjectTask, CalendarItem } from '../types';

interface Props {
  events: BudgetEvent[];
  calendarItems: CalendarItem[];
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  recurringIncomes: RecurringIncome[];
  onUpdateItems: (items: CalendarItem[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const Calendar: React.FC<Props> = ({ events, calendarItems, transactions, recurringExpenses, recurringIncomes, onUpdateItems }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  };

  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  // Virtual Recurring Logic: Expand items into specific month occurrences
  const expandedCalendarItems = useMemo(() => {
    const items: (CalendarItem & { isVirtual?: boolean })[] = [];
    
    calendarItems.forEach(item => {
      if (item.recurring === 'none') {
        items.push(item);
        return;
      }

      // Calculate occurrences for this month
      const start = new Date(item.date);
      for (let d = 1; d <= daysInMonth; d++) {
        const current = new Date(year, month, d);
        if (current < start) continue;

        let match = false;
        if (item.recurring === 'daily') match = true;
        if (item.recurring === 'weekly' && current.getDay() === start.getDay()) match = true;
        if (item.recurring === 'monthly' && current.getDate() === start.getDate()) match = true;

        if (match) {
          items.push({
            ...item,
            id: `${item.id}-${d}`,
            date: current.toISOString().split('T')[0],
            isVirtual: current.toISOString().split('T')[0] !== item.date
          });
        }
      }
    });

    return items;
  }, [calendarItems, year, month, daysInMonth]);

  const allTasks = useMemo(() => {
    const tasks: { task: ProjectTask; eventName: string }[] = [];
    events.forEach(event => {
      (event.tasks || []).forEach(task => {
        if (task.dueDate) {
          tasks.push({ task, eventName: event.name });
        }
      });
    });
    return tasks;
  }, [events]);

  const getDayDetails = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayProjects = events.filter(e => e.date === dateStr);
    const dayTransactions = transactions.filter(t => t.date === dateStr);
    const dayTasks = allTasks.filter(t => t.task.dueDate === dateStr);
    const dayCalendarItems = expandedCalendarItems.filter(ci => ci.date === dateStr);
    
    const dayRecurringEx = recurringExpenses.filter(re => {
        const nextDue = new Date(re.nextDueDate);
        return nextDue.getDate() === day && nextDue.getMonth() === month && nextDue.getFullYear() === year;
    });
    
    const dayRecurringIn = recurringIncomes.filter(ri => {
        const nextConf = new Date(ri.nextConfirmationDate);
        return nextConf.getDate() === day && nextConf.getMonth() === month && nextConf.getFullYear() === year;
    });

    return { dayProjects, dayTransactions, dayTasks, dayRecurringEx, dayRecurringIn, dayCalendarItems };
  };

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  const selectedDayData = selectedDay ? getDayDetails(selectedDay.getDate()) : null;

  const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newItem: CalendarItem = {
      id: editingItem?.id || generateId(),
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      type: formData.get('type') as any,
      recurring: formData.get('recurring') as any,
      startTime: formData.get('startTime') as string,
      description: formData.get('description') as string,
      completed: editingItem?.completed || false
    };

    if (editingItem) {
      onUpdateItems(calendarItems.map(item => item.id === editingItem.id ? newItem : item));
    } else {
      onUpdateItems([...calendarItems, newItem]);
    }
    setShowEditor(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    const originalId = id.split('-')[0];
    onUpdateItems(calendarItems.filter(item => item.id !== originalId));
  };

  const toggleComplete = (id: string) => {
    const originalId = id.split('-')[0];
    onUpdateItems(calendarItems.map(item => item.id === originalId ? { ...item, completed: !item.completed } : item));
  };

  const startEdit = (item: CalendarItem) => {
    const originalId = item.id.split('-')[0];
    const original = calendarItems.find(i => i.id === originalId);
    if (original) {
      setEditingItem(original);
      setShowEditor(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <i className="fas fa-calendar-alt text-[100px] text-slate-900"></i>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{monthName} <span className="text-indigo-600">{year}</span></h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-2">Operational Intelligence Grid</p>
        </div>
        <div className="flex items-center bg-slate-100 p-2 rounded-3xl gap-2 relative z-10">
          <button onClick={prevMonth} className="w-12 h-12 flex items-center justify-center bg-white text-slate-600 rounded-2xl shadow-sm hover:text-indigo-600 transition-all"><i className="fas fa-chevron-left"></i></button>
          <button onClick={goToToday} className="px-6 h-12 flex items-center justify-center bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm hover:text-indigo-600 transition-all">Today</button>
          <button onClick={nextMonth} className="w-12 h-12 flex items-center justify-center bg-white text-slate-600 rounded-2xl shadow-sm hover:text-indigo-600 transition-all"><i className="fas fa-chevron-right"></i></button>
          <div className="w-px h-8 bg-slate-200 mx-2"></div>
          <button onClick={() => { setEditingItem(null); setShowEditor(true); }} className="px-6 h-12 flex items-center justify-center bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-600 transition-all">
             <i className="fas fa-plus mr-2"></i> Schedule
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 bg-white p-2 rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-900/5 p-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-100">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[140px]"></div>;
              
              const { dayProjects, dayTasks, dayRecurringEx, dayRecurringIn, dayCalendarItems } = getDayDetails(day);
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDay(new Date(year, month, day))}
                  className={`bg-white min-h-[140px] p-3 transition-all cursor-pointer group relative hover:z-10 ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-[11px] font-black ${isToday ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                      {day}
                    </span>
                  </div>
                  
                  <div className="space-y-1 max-h-[90px] overflow-y-auto no-scrollbar">
                    {dayCalendarItems.map(ci => (
                      <div key={ci.id} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded truncate border flex items-center gap-1 ${
                        ci.type === 'meeting' ? 'bg-slate-900 text-white border-slate-800' : 
                        ci.type === 'reminder' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                        'bg-indigo-100 text-indigo-700 border-indigo-200'
                      } ${ci.completed ? 'opacity-40 grayscale line-through' : ''}`}>
                         {ci.recurring !== 'none' && <i className="fas fa-redo text-[6px]"></i>}
                         {ci.startTime && <span className="opacity-60">{ci.startTime}</span>}
                         {ci.title}
                      </div>
                    ))}
                    {dayProjects.map(e => (
                      <div key={e.id} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded truncate border border-emerald-200">Project: {e.name}</div>
                    ))}
                    {dayTasks.map(t => (
                      <div key={t.task.id} className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded truncate border border-rose-200">Phase: {t.task.text}</div>
                    ))}
                    {dayRecurringEx.map(re => (
                      <div key={re.id} className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded truncate border border-rose-200">Bill: {re.description}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl h-[700px] flex flex-col">
            <h3 className="text-indigo-400 font-black uppercase text-[10px] tracking-[0.4em] mb-6 flex justify-between items-center">
               <span>Day Operational Report</span>
               <i className="fas fa-shield-halved opacity-50"></i>
            </h3>
            {selectedDay ? (
              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-end">
                   <div>
                     <p className="text-white font-black text-2xl tracking-tighter mb-1">{selectedDay.toLocaleDateString('default', { day: 'numeric', month: 'long' })}</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedDay.toLocaleDateString('default', { weekday: 'long' })}</p>
                   </div>
                   <button onClick={() => { setEditingItem(null); setShowEditor(true); }} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/50">
                     <i className="fas fa-calendar-plus"></i>
                   </button>
                </div>

                {selectedDayData && (
                  <div className="space-y-8">
                    {/* Personal Schedule */}
                    {(selectedDayData.dayCalendarItems || []).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Schedule & Directives</p>
                        {selectedDayData.dayCalendarItems.map(ci => (
                          <div key={ci.id} className={`p-4 rounded-[2rem] border transition-all relative group ${
                            ci.type === 'meeting' ? 'bg-white/5 border-white/10' : 
                            ci.type === 'reminder' ? 'bg-amber-500/10 border-amber-500/20' : 
                            'bg-indigo-500/10 border-indigo-500/20'
                          } ${ci.completed ? 'opacity-40 grayscale' : ''}`}>
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                                    ci.type === 'meeting' ? 'bg-white text-slate-900' : 'bg-indigo-500 text-white'
                                  }`}>
                                    {ci.type}
                                  </span>
                                  {ci.startTime && <span className="text-[9px] font-black text-slate-400">{ci.startTime}</span>}
                                  {ci.recurring !== 'none' && <i className="fas fa-redo text-[8px] text-indigo-400"></i>}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {ci.type === 'reminder' && (
                                    <button onClick={() => toggleComplete(ci.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] ${ci.completed ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>
                                      <i className="fas fa-check"></i>
                                    </button>
                                  )}
                                  <button onClick={() => startEdit(ci)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-slate-400 text-[10px] hover:bg-white/20">
                                    <i className="fas fa-pencil-alt"></i>
                                  </button>
                                  <button onClick={() => handleDeleteItem(ci.id)} className="w-7 h-7 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-500 text-[10px] hover:bg-rose-500/20">
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>
                             </div>
                             <p className={`text-sm font-black ${ci.completed ? 'line-through' : ''}`}>{ci.title}</p>
                             {ci.description && <p className="text-[10px] text-slate-500 font-medium mt-1">{ci.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDayData.dayProjects.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Active Project Frames</p>
                        {selectedDayData.dayProjects.map(e => (
                          <div key={e.id} className="p-4 bg-white/5 border border-white/10 rounded-[2rem]">
                             <p className="text-xs font-black text-white">{e.name}</p>
                             <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">Status: {e.status}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDayData.dayTasks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Project Phase Deadlines</p>
                        {selectedDayData.dayTasks.map(t => (
                          <div key={t.task.id} className="p-4 bg-white/5 border border-white/10 rounded-[2rem] flex justify-between items-center">
                             <div>
                               <p className="text-xs font-black text-white">{t.task.text}</p>
                               <p className="text-[9px] text-slate-500 uppercase font-black mt-1">Ref: {t.eventName}</p>
                             </div>
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] ${t.task.completed ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-600 border border-white/10'}`}>
                               <i className={`fas ${t.task.completed ? 'fa-check' : 'fa-clock'}`}></i>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(selectedDayData.dayRecurringEx.length > 0 || selectedDayData.dayRecurringIn.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Financial Obligations</p>
                        {selectedDayData.dayRecurringEx.map(re => (
                          <div key={re.id} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] flex justify-between items-center">
                             <div>
                               <p className="text-xs font-black text-rose-400">{re.description}</p>
                               <p className="text-[9px] text-slate-500 uppercase font-black">Capital Outflow</p>
                             </div>
                             <span className="text-sm font-black text-rose-500">-${re.amount}</span>
                          </div>
                        ))}
                        {selectedDayData.dayRecurringIn.map(ri => (
                          <div key={ri.id} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] flex justify-between items-center">
                             <div>
                               <p className="text-xs font-black text-emerald-400">{ri.description}</p>
                               <p className="text-[9px] text-slate-500 uppercase font-black">Capital Inflow</p>
                             </div>
                             <span className="text-sm font-black text-emerald-500">+${ri.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDayData.dayCalendarItems.length === 0 && 
                     selectedDayData.dayProjects.length === 0 && 
                     selectedDayData.dayTasks.length === 0 && 
                     selectedDayData.dayRecurringEx.length === 0 && 
                     selectedDayData.dayRecurringIn.length === 0 && (
                      <div className="py-20 text-center opacity-20">
                         <i className="fas fa-shield-blank text-4xl mb-4"></i>
                         <p className="text-[10px] font-black uppercase tracking-widest">Zero Operations Logged</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-30">
                <i className="fas fa-crosshairs text-4xl mb-6"></i>
                <p className="text-xs font-black uppercase tracking-widest">Target a grid node to visualize localized tactical reports</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
               <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{editingItem ? 'Modify Directive' : 'Schedule Directive'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Log Matrix Entry</p>
                  </div>
                  <button onClick={() => { setShowEditor(false); setEditingItem(null); }} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"><i className="fas fa-times"></i></button>
               </div>

               <form onSubmit={handleSaveItem} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Entry Title</label>
                    <input name="title" defaultValue={editingItem?.title} required placeholder="Operational Title..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Date</label>
                      <input type="date" name="date" required defaultValue={editingItem?.date || selectedDay?.toISOString().split('T')[0]} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Start Time</label>
                      <input type="time" name="startTime" defaultValue={editingItem?.startTime} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Type</label>
                      <select name="type" defaultValue={editingItem?.type || 'meeting'} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 appearance-none">
                        <option value="meeting">Meeting</option>
                        <option value="reminder">Reminder</option>
                        <option value="event">Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Recurrence</label>
                      <select name="recurring" defaultValue={editingItem?.recurring || 'none'} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 appearance-none">
                        <option value="none">Once</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Description / Notes</label>
                    <textarea name="description" defaultValue={editingItem?.description} placeholder="Operational details..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-600 h-24" />
                  </div>

                  <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-600 transition-all">
                     {editingItem ? 'Update Lifecycle' : 'Commence Directive'}
                  </button>
               </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
