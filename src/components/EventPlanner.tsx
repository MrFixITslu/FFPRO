
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, ProjectTask, ProjectFile, EventLog, Contact, User, TripPlanDetails, StartupPlanDetails } from '../types';
import { saveFileToHardDrive, getFileFromHardDrive, triggerSecureDownload, saveInternalDoc, getInternalDoc } from '../services/fileStorageService';
import DocumentEditor from './DocumentEditor';
import ExcelEditor from './ExcelEditor';
import { 
  Plane, Hotel, Car, Utensils, Compass, Calendar as CalendarIcon, DollarSign, Check, 
  MapPin, Clock, ArrowRight, ShieldCheck, Tag, Plus, CheckSquare, 
  Square, FileText, Briefcase, TrendingUp, AlertCircle, Info, Archive, Globe, Sparkles,
  Trash2, Percent, Calculator, Settings
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'team' | 'contacts' | 'log' | 'trip_planner' | 'startup_planner';

const getInitialChecklist = (planType: 'event' | 'trip' | 'startup'): ProjectTask[] => {
  if (planType === 'trip') {
    return [
      { id: 't1', text: 'Verify passport validity (needs at least 6 months left)', completed: false, subTasks: [] },
      { id: 't2', text: 'Research local visa and health requirements', completed: false, subTasks: [] },
      { id: 't3', text: 'Confirm flight bookings', completed: false, subTasks: [] },
      { id: 't4', text: 'Secure hotel or Airbnb accommodations', completed: false, subTasks: [] },
      { id: 't5', text: 'Decide on Transport (Book Rental Car or pre-arrange Airport Taxi)', completed: false, subTasks: [] },
      { id: 't6', text: 'Purchase comprehensive travel insurance', completed: false, subTasks: [] },
      { id: 't7', text: 'Notify bank and credit cards of travel dates', completed: false, subTasks: [] },
      { id: 't8', text: 'Exchange cash to local currency / verify ATM card access', completed: false, subTasks: [] },
      { id: 't9', text: 'Pack bags based on destination weather forecast', completed: false, subTasks: [] },
      { id: 't10', text: 'Create a loose daily itinerary of sights and attractions', completed: false, subTasks: [] },
    ];
  } else if (planType === 'startup') {
    return [
      { id: 's1', text: 'Conduct market research and feasibility study', completed: false, subTasks: [] },
      { id: 's2', text: 'Define your unique selling proposition (USP)', completed: false, subTasks: [] },
      { id: 's3', text: 'Set prices of goods or services with price calculator', completed: false, subTasks: [] },
      { id: 's4', text: 'Generate 1, 3, and 5-year profit and loss statements', completed: false, subTasks: [] },
      { id: 's5', text: 'Prepare financial presentation for Caribbean loan institutions', completed: false, subTasks: [] },
      { id: 's6', text: 'Register business entity and secure local licenses', completed: false, subTasks: [] },
      { id: 's7', text: 'Open a business banking account', completed: false, subTasks: [] },
    ];
  } else {
    return [
      { id: 'e1', text: 'Establish event budget and core theme', completed: false, subTasks: [] },
      { id: 'e2', text: 'Secure venue booking and confirm dates', completed: false, subTasks: [] },
      { id: 'e3', text: 'Select and hire catering services', completed: false, subTasks: [] },
      { id: 'e4', text: 'Organize entertainment, sound, and AV equipment', completed: false, subTasks: [] },
      { id: 'e5', text: 'Send invitations and track RSVPs', completed: false, subTasks: [] },
      { id: 'e6', text: 'Determine decorating supplies and staff schedule', completed: false, subTasks: [] },
    ];
  }
};

const MOCK_ONLINE_USERS: User[] = [
  { id: 'u1', name: 'nsv', role: 'admin', online: true },
  { id: 'u2', name: 'Sarah', role: 'collaborator', online: true },
  { id: 'u3', name: 'John', role: 'collaborator', online: true },
  { id: 'u4', name: 'Michael', role: 'collaborator', online: false },
];

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  directoryHandle: FileSystemDirectoryHandle | null;
  currentUser: string;
  isAdmin: boolean;
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds' | 'memberUsernames' | 'ious' | 'lastUpdated' | 'logs'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
  onMountVault?: () => void;
}

const EventPlanner: React.FC<Props> = ({ events, contacts, directoryHandle, currentUser, isAdmin, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts, onMountVault }) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  
  const [selectedPlanType, setSelectedPlanType] = useState<'event' | 'trip' | 'startup'>('event');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [taskText, setTaskText] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [subTaskInputs, setSubTaskInputs] = useState<Record<string, string>>({});

  // Editor States
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [isEditingSheet, setIsEditingSheet] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<{ id?: string, title: string, content: string } | null>(null);

  // Contact States
  const [contactSearch, setContactSearch] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', number: '', email: '' });

  // Sale Price Calculator Local State
  const [calcItemName, setCalcItemName] = useState('');
  const [calcItemCost, setCalcItemCost] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => (events || []).find(e => e.id === selectedEventId), [events, selectedEventId]);

  // Automatically select the primary tab based on the type of project opened
  useEffect(() => {
    if (selectedEvent) {
      if (selectedEvent.eventType === 'trip') {
        setActiveTab('trip_planner');
      } else if (selectedEvent.eventType === 'startup') {
        setActiveTab('startup_planner');
      } else {
        setActiveTab('ledger');
      }
    }
  }, [selectedEventId, selectedEvent?.eventType]);

  const addActionLog = (event: BudgetEvent, action: string, type: EventLog['type']) => {
    const newLog: EventLog = {
      id: generateId(),
      action,
      timestamp: new Date().toISOString(),
      username: currentUser,
      type
    };
    onUpdateEvent({
      ...event,
      logs: [newLog, ...(event.logs || [])],
      lastUpdated: new Date().toISOString()
    });
  };

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const description = (formData.get('description') as string || '').trim();
    if (!description || isNaN(amount)) return;
    
    const newItem: EventItem = {
      id: generateId(),
      description,
      amount,
      type: formData.get('type') as 'income' | 'expense',
      category: formData.get('category') as string,
      date: new Date().toISOString().split('T')[0]
    };

    const updatedEvent = { ...selectedEvent, items: [...(selectedEvent.items || []), newItem] };
    addActionLog(updatedEvent, `Added ${newItem.type}: "${description}" ($${amount})`, 'transaction');
    e.currentTarget.reset();
  };

  const handleAddTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText.trim(),
      completed: false,
      assignedToId: currentUser,
      subTasks: []
    };
    const updatedEvent = { ...selectedEvent, tasks: [...(selectedEvent.tasks || []), newTask] };
    addActionLog(updatedEvent, `Deployed milestone: "${newTask.text}"`, 'task');
    setTaskText('');
  };

  const handleAddSubTask = (parentTaskId: string) => {
    const text = subTaskInputs[parentTaskId];
    if (!selectedEvent || !text?.trim()) return;

    const newSubTask: ProjectTask = {
      id: generateId(),
      text: text.trim(),
      completed: false,
      assignedToId: currentUser,
      subTasks: []
    };

    const updatedTasks = (selectedEvent.tasks || []).map(t => {
      if (t.id === parentTaskId) {
        return { ...t, subTasks: [...(t.subTasks || []), newSubTask] };
      }
      return t;
    });

    const updatedEvent = { ...selectedEvent, tasks: updatedTasks };
    addActionLog(updatedEvent, `Linked sub-milestone to "${parentTaskId}": "${newSubTask.text}"`, 'task');
    setSubTaskInputs(prev => ({ ...prev, [parentTaskId]: '' }));
  };

  const toggleTaskCompletion = (taskId: string, parentTaskId?: string) => {
    if (!selectedEvent) return;
    
    let updatedTasks: ProjectTask[];
    if (parentTaskId) {
      updatedTasks = (selectedEvent.tasks || []).map(t => {
        if (t.id === parentTaskId) {
          return {
            ...t,
            subTasks: (t.subTasks || []).map(st => st.id === taskId ? { ...st, completed: !st.completed } : st)
          };
        }
        return t;
      });
    } else {
      updatedTasks = (selectedEvent.tasks || []).map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
    }
    
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
  };

  const handleAddMember = () => {
    if (!selectedEvent || !inviteUsername.trim()) return;
    const currentMembers = selectedEvent.memberUsernames || [];
    if (currentMembers.includes(inviteUsername.trim())) return;
    
    const updatedEvent = { 
      ...selectedEvent, 
      memberUsernames: [...currentMembers, inviteUsername.trim()] 
    };
    addActionLog(updatedEvent, `Authorized user "${inviteUsername.trim()}"`, 'team');
    setInviteUsername('');
  };

  const handleLinkContact = (contactId: string) => {
    if (!selectedEvent) return;
    const currentIds = selectedEvent.contactIds || [];
    if (currentIds.includes(contactId)) return;

    const updatedEvent = { ...selectedEvent, contactIds: [...currentIds, contactId] };
    const contact = contacts.find(c => c.id === contactId);
    addActionLog(updatedEvent, `Linked stakeholder: "${contact?.name || 'Unknown'}"`, 'contact');
    onUpdateEvent(updatedEvent);
  };

  const handleUnlinkContact = (contactId: string) => {
    if (!selectedEvent) return;
    const updatedEvent = { 
      ...selectedEvent, 
      contactIds: (selectedEvent.contactIds || []).filter(id => id !== contactId) 
    };
    const contact = contacts.find(c => c.id === contactId);
    addActionLog(updatedEvent, `Removed stakeholder: "${contact?.name || 'Unknown'}"`, 'contact');
    onUpdateEvent(updatedEvent);
  };

  const handleCreateContact = () => {
    if (!newContact.name) return;
    const contact: Contact = { ...newContact, id: generateId() };
    onUpdateContacts([...contacts, contact]);
    if (selectedEvent) handleLinkContact(contact.id);
    setNewContact({ name: '', number: '', email: '' });
    setShowContactForm(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedEvent || !file) return;

    if (!directoryHandle) {
      alert("Hard Drive Vault not linked. Mirroring unavailable.");
      return;
    }

    try {
      const storageRef = await saveFileToHardDrive(directoryHandle, selectedEvent.name, file.name, file);
      const newFile: ProjectFile = {
        id: generateId(),
        name: file.name,
        type: file.type,
        size: file.size,
        timestamp: new Date().toISOString(),
        storageRef,
        storageType: 'filesystem',
        version: 1,
        lastModifiedBy: currentUser
      };
      
      const updatedEvent = { ...selectedEvent, files: [...(selectedEvent.files || []), newFile] };
      onUpdateEvent(updatedEvent);
      addActionLog(updatedEvent, `Linked local asset: "${file.name}"`, 'file');
    } catch (err: any) {
      console.error("Vault access error:", err);
      alert(`Vault Access Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateTripDetails = (fields: Partial<TripPlanDetails>) => {
    if (!selectedEvent || !selectedEvent.tripDetails) return;
    const updatedEvent: BudgetEvent = {
      ...selectedEvent,
      tripDetails: {
        ...selectedEvent.tripDetails,
        ...fields
      },
      lastUpdated: new Date().toISOString()
    };
    onUpdateEvent(updatedEvent);
  };

  const handleSaveDocument = async (title: string, content: string, extension: '.fdoc' | '.fcel' = '.fdoc') => {
    if (!selectedEvent) return;
    
    const docId = currentDoc?.id || generateId();
    const fileName = `${title.trim().replace(/[^a-z0-9]/gi, '_')}${extension}`;

    try {
      await saveInternalDoc(docId, content);

      let storageRef = `internal/${docId}`;
      let storageType: 'indexeddb' | 'filesystem' = 'indexeddb';

      if (directoryHandle) {
        try {
          const blob = new Blob([content], { type: 'text/html' });
          storageRef = await saveFileToHardDrive(directoryHandle, selectedEvent.name, fileName, blob);
          storageType = 'filesystem';
        } catch (mirrorErr) {
          console.warn("Mirroring failed.");
        }
      }

      let updatedFiles = [...(selectedEvent.files || [])];
      const existingFile = updatedFiles.find(f => f.id === docId);

      if (existingFile) {
        updatedFiles = updatedFiles.map(f => f.id === docId ? {
          ...f,
          name: fileName,
          timestamp: new Date().toISOString(),
          lastModifiedBy: currentUser,
          version: (f.version || 1) + 1,
          storageRef,
          storageType
        } : f);
      } else {
        const newFile: ProjectFile = {
          id: docId,
          name: fileName,
          type: extension === '.fdoc' ? 'application/fire-doc' : 'application/fire-cell',
          size: content.length,
          timestamp: new Date().toISOString(),
          storageRef,
          storageType,
          version: 1,
          lastModifiedBy: currentUser
        };
        updatedFiles.push(newFile);
      }

      const updatedEvent = { 
        ...selectedEvent, 
        files: updatedFiles,
        lastUpdated: new Date().toISOString()
      };
      
      onUpdateEvent(updatedEvent); 
      addActionLog(updatedEvent, `Vault Commit: "${fileName}"`, 'file');
      setCurrentDoc({ id: docId, title, content });
    } catch (err: any) {
      alert(`Save Failure: ${err.message}`);
      throw err;
    }
  };

  const handleAssetClick = async (file: ProjectFile) => {
    const isDoc = file.name.endsWith('.fdoc') || file.type === 'application/fire-doc';
    const isSheet = file.name.endsWith('.fcel') || file.type === 'application/fire-cell';
    
    if (isDoc || isSheet) {
      try {
        let content = await getInternalDoc(file.id);
        if (!content && directoryHandle && file.storageType === 'filesystem') {
          const blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
          content = await blob.text();
        }

        if (content) {
          setCurrentDoc({ id: file.id, title: file.name.replace(/\.(fdoc|fcel)$/, ''), content });
          if (isDoc) setIsEditingDoc(true);
          else setIsEditingSheet(true);
        } else {
          throw new Error("Asset missing.");
        }
      } catch (err) {
        alert("Retrieval Error.");
      }
      return;
    }

    if (file.storageType === 'url') {
      window.open(file.storageRef, '_blank');
      return;
    }

    if (file.storageType === 'filesystem') {
      if (!directoryHandle) {
        alert("SSD Mirror Disconnected.");
        return;
      }
      try {
        const blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
        triggerSecureDownload(blob, file.name);
      } catch (err: any) {
        alert(`Access Denied.`);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-2">
      {isEditingDoc && (
        <DocumentEditor 
          initialTitle={currentDoc?.title || "Draft"}
          initialContent={currentDoc?.content || ""}
          onSave={(t, c) => handleSaveDocument(t, c, '.fdoc')}
          onClose={() => { setIsEditingDoc(false); setCurrentDoc(null); }}
          isVaultMounted={!!directoryHandle}
          onMountVault={onMountVault}
        />
      )}

      {isEditingSheet && (
        <ExcelEditor 
          initialTitle={currentDoc?.title || "Sheet"}
          initialData={currentDoc?.content || ""}
          onSave={(t, d) => handleSaveDocument(t, d, '.fcel')}
          onClose={() => { setIsEditingSheet(false); setCurrentDoc(null); }}
          isVaultMounted={!!directoryHandle}
          onMountVault={onMountVault}
        />
      )}

      {/* STORAGE INDICATOR */}
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-850 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {MOCK_ONLINE_USERS.filter(u => u.online).map(u => (
              <div key={u.id} className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold uppercase text-white shadow-sm">
                {u.name[0]}
              </div>
            ))}
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Storage Node</span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">
              {directoryHandle ? `MIRROR: ${directoryHandle.name}` : 'INTERNAL VAULT ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-light tracking-tight text-slate-800">Projects</h2>
        {isAdmin && !selectedEventId && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-500 transition-all">
            {showAddForm ? 'Cancel' : 'Initiate Framework'}
          </button>
        )}
      </div>

      {showAddForm && !selectedEventId && (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in zoom-in-95 mb-6 space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Select Planning Framework</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button 
                type="button"
                onClick={() => { setSelectedPlanType('event'); if (newName.startsWith('Vacation to ') || newName.startsWith('Startup: ')) setNewName(''); }}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedPlanType === 'event' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`p-2 rounded-lg ${selectedPlanType === 'event' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Standard Event</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Plan corporate events, fundraisers, gatherings, or custom ledgers.</p>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => setSelectedPlanType('trip')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedPlanType === 'trip' ? 'border-sky-600 bg-sky-50/50 ring-1 ring-sky-600' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`p-2 rounded-lg ${selectedPlanType === 'trip' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Plane size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Vacation / Trip Plan</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Estimate flights, hotels, rentals, set up savings schedule, or log travel contacts.</p>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => { setSelectedPlanType('startup'); if (newName.startsWith('Vacation to ')) setNewName(''); }}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedPlanType === 'startup' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`p-2 rounded-lg ${selectedPlanType === 'startup' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Briefcase size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Startup Planner</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Establish price models, generate 1/3/5 yr P&L statements for Caribbean bank loans.</p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Plan Title / Project Designation</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder={selectedPlanType === 'trip' ? "e.g. Summer Getaway 2026" : selectedPlanType === 'startup' ? "e.g. Island Grocers Ltd." : "e.g. Charity Gala Opening"} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-850 rounded-lg outline-none font-semibold text-sm focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all" 
              />
            </div>

            {selectedPlanType === 'trip' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Find Destination</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      value={destination} 
                      onChange={(e) => {
                        setDestination(e.target.value);
                        if (!newName || newName.startsWith('Vacation to ')) {
                          setNewName(e.target.value ? `Vacation to ${e.target.value}` : '');
                        }
                      }} 
                      placeholder="e.g. Barbados, Paris" 
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-850 rounded-lg outline-none font-semibold text-sm focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-850 rounded-lg outline-none font-semibold text-sm focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-850 rounded-lg outline-none font-semibold text-sm focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={() => { 
              if (!newName.trim()) return; 
              
              let tripDetails = undefined;
              let startupDetails = undefined;
              if (selectedPlanType === 'trip') {
                tripDetails = {
                  destination: destination.trim() || 'Unknown Destination',
                  startDate: startDate || undefined,
                  endDate: endDate || undefined,
                  flightCost: 0,
                  flightNotes: '',
                  flightBooked: false,
                  accommodationCost: 0,
                  accommodationNotes: '',
                  accommodationBooked: false,
                  transportType: 'none' as const,
                  transportCost: 0,
                  transportNotes: '',
                  transportBooked: false,
                  foodCost: 0,
                  foodNotes: '',
                  sitesCost: 0,
                  sitesNotes: '',
                  savingMode: 'save' as const,
                  targetDate: startDate || '',
                  amountSaved: 0
                };
              } else if (selectedPlanType === 'startup') {
                startupDetails = {
                  cogs: 10,
                  markup: 50,
                  monthlyVolume: 500,
                  rent: 800,
                  salaries: 1500,
                  marketing: 300,
                  utilities: 200,
                  otherExpenses: 200,
                  growthRateYear3: 15,
                  growthRateYear5: 35,
                  productionItems: [],
                  derivedUnits: 1,
                  hourlyRate: 20,
                  laborHours: 5,
                  desiredProfitType: 'percentage' as const,
                  desiredProfitValue: 50,
                  includeVat: false,
                  includeLevy: false,
                  contingencyPercent: 5,
                  allocateOverhead: false
                };
              }

              const initialTasks = getInitialChecklist(selectedPlanType);

              onAddEvent({ 
                name: newName.trim(), 
                date: startDate || new Date().toISOString().split('T')[0], 
                status: 'active',
                eventType: selectedPlanType,
                tripDetails,
                startupDetails,
                tasks: initialTasks
              }); 

              setShowAddForm(false); 
              setNewName(''); 
              setDestination('');
              setStartDate('');
              setEndDate('');
              setSelectedPlanType('event');
            }} 
            className={`w-full py-2.5 text-white font-bold rounded-lg shadow-sm uppercase tracking-wider text-[11px] transition-all ${selectedPlanType === 'trip' ? 'bg-sky-600 hover:bg-sky-500' : selectedPlanType === 'startup' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            Deploy {selectedPlanType === 'trip' ? 'Vacation Plan' : selectedPlanType === 'startup' ? 'Startup Plan' : 'Standard Event'}
          </button>
        </div>
      )}

      {selectedEventId && selectedEvent ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 p-5 rounded-xl shadow-sm overflow-hidden relative ${
            selectedEvent.eventType === 'trip' 
              ? 'bg-gradient-to-r from-sky-600 to-teal-500' 
              : selectedEvent.eventType === 'startup'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
              : 'bg-indigo-600'
          }`}>
             <div className="flex items-center gap-4 relative z-10">
               <button onClick={() => setSelectedEventId(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded hover:bg-white/20 transition-all border border-white/5 shadow-sm"><i className="fas fa-chevron-left text-xs"></i></button>
               <div>
                 <h2 className="text-2xl font-bold text-white tracking-tight leading-none">{selectedEvent.name}</h2>
                 <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider mt-1.5">
                   {selectedEvent.eventType === 'trip' 
                     ? `Vacation to ${selectedEvent.tripDetails?.destination || 'Destination'}` 
                     : selectedEvent.eventType === 'startup'
                     ? 'Startup Business Suite' 
                     : 'Event Management Framework'}
                 </p>
               </div>
              </div>
             <div className="flex bg-black/20 p-1 rounded-lg border border-white/10 overflow-x-auto no-scrollbar relative z-10 backdrop-blur-md">
               {(selectedEvent.eventType === 'trip' 
                 ? ['trip_planner', 'tasks', 'vault', 'contacts', 'log']
                 : selectedEvent.eventType === 'startup'
                 ? ['startup_planner', 'tasks', 'vault', 'contacts', 'log']
                 : ['ledger', 'tasks', 'vault', 'team', 'contacts', 'log']
               ).map(tab => {
                 const label = tab === 'trip_planner' ? 'Trip Details' : tab === 'startup_planner' ? 'Business Plan' : tab === 'tasks' ? 'Checklist' : tab === 'vault' ? 'Documents' : tab === 'team' ? 'Team' : tab === 'contacts' ? 'Contacts' : tab === 'log' ? 'Activity' : 'Ledger';
                 return (
                   <button key={tab} onClick={() => setActiveTab(tab as ProjectTab)} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>{label}</button>
                 );
               })}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'trip_planner' && selectedEvent.tripDetails && (() => {
              const td = selectedEvent.tripDetails;
              const totalCost = td.flightCost + td.accommodationCost + td.transportCost + td.foodCost + td.sitesCost;
              
              // Savings calculations
              let daysLeft = 0;
              let weeksLeft = 1;
              let monthsLeft = 1;
              if (td.targetDate) {
                const targetTime = new Date(td.targetDate).getTime();
                const nowTime = new Date().getTime();
                const diffTime = targetTime - nowTime;
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
                monthsLeft = Math.max(1, Math.ceil(daysLeft / 30.4));
              }
              const remainingToSave = Math.max(0, totalCost - td.amountSaved);
              const weeklySavings = Math.round(remainingToSave / weeksLeft);
              const monthlySavings = Math.round(remainingToSave / monthsLeft);
              const progressPct = totalCost > 0 ? Math.min(100, Math.round((td.amountSaved / totalCost) * 100)) : 0;

              return (
                <div className="space-y-6 animate-in fade-in duration-350">
                  {/* Financial Summary Dashboard Banner */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md">
                    <div>
                      <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest block mb-1">Financial Blueprint</span>
                      <h3 className="text-xl font-light">Trip to <span className="font-semibold text-sky-300">{td.destination}</span></h3>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        {td.startDate && <span className="flex items-center gap-1"><CalendarIcon size={12} className="text-sky-400" /> {new Date(td.startDate).toLocaleDateString()}</span>}
                        {td.endDate && <span>to {new Date(td.endDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Total</span>
                      <span className="text-2xl font-black text-white">${totalCost.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Bento Grid Cost Estimator */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cost Estimations & Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      
                      {/* Flight Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-sky-100 text-sky-600 rounded-lg"><Plane size={16} /></div>
                              <h5 className="font-bold text-xs text-slate-800">Flights / Airfare</h5>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${td.flightBooked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {td.flightBooked ? 'Booked' : 'Tentative'}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={td.flightCost || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ flightCost: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500 focus:bg-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Booking Notes / Airline</label>
                              <textarea 
                                value={td.flightNotes || ''} 
                                onChange={(e) => handleUpdateTripDetails({ flightNotes: e.target.value })}
                                placeholder="Carrier, route, baggage allowances..." 
                                className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-[11px] font-medium focus:ring-1 focus:ring-sky-500 focus:bg-white h-16 resize-none" 
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 font-medium">Mark as Booked</span>
                          <button 
                            type="button"
                            onClick={() => handleUpdateTripDetails({ flightBooked: !td.flightBooked })}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${td.flightBooked ? 'bg-emerald-500 flex justify-end' : 'bg-slate-200 flex justify-start'}`}
                          >
                            <span className="w-4 h-4 bg-white rounded-full shadow-sm block"></span>
                          </button>
                        </div>
                      </div>

                      {/* Accommodation Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-sky-100 text-sky-600 rounded-lg"><Hotel size={16} /></div>
                              <h5 className="font-bold text-xs text-slate-800">Accommodation</h5>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${td.accommodationBooked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {td.accommodationBooked ? 'Booked' : 'Tentative'}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={td.accommodationCost || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ accommodationCost: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500 focus:bg-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hotel / Airbnb Notes</label>
                              <textarea 
                                value={td.accommodationNotes || ''} 
                                onChange={(e) => handleUpdateTripDetails({ accommodationNotes: e.target.value })}
                                placeholder="Hotel name, check-in details, room type..." 
                                className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-[11px] font-medium focus:ring-1 focus:ring-sky-500 focus:bg-white h-16 resize-none" 
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 font-medium">Mark as Booked</span>
                          <button 
                            type="button"
                            onClick={() => handleUpdateTripDetails({ accommodationBooked: !td.accommodationBooked })}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${td.accommodationBooked ? 'bg-emerald-500 flex justify-end' : 'bg-slate-200 flex justify-start'}`}
                          >
                            <span className="w-4 h-4 bg-white rounded-full shadow-sm block"></span>
                          </button>
                        </div>
                      </div>

                      {/* Transport Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-sky-100 text-sky-600 rounded-lg"><Car size={16} /></div>
                              <h5 className="font-bold text-xs text-slate-800">Ground Transport</h5>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${td.transportBooked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {td.transportBooked ? 'Booked' : 'Tentative'}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-1">
                              {(['rental', 'taxi', 'public'] as const).map(mode => (
                                <button 
                                  key={mode}
                                  type="button"
                                  onClick={() => handleUpdateTripDetails({ transportType: mode })}
                                  className={`py-1 rounded text-[9px] font-bold capitalize border transition-all ${td.transportType === mode ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                                >
                                  {mode}
                                </button>
                              ))}
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={td.transportCost || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ transportCost: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500 focus:bg-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Car Rental / Cab Details</label>
                              <textarea 
                                value={td.transportNotes || ''} 
                                onChange={(e) => handleUpdateTripDetails({ transportNotes: e.target.value })}
                                placeholder="Hertz, airport pickup, taxi options..." 
                                className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-[11px] font-medium focus:ring-1 focus:ring-sky-500 focus:bg-white h-12 resize-none" 
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 font-medium">Mark as Booked</span>
                          <button 
                            type="button"
                            onClick={() => handleUpdateTripDetails({ transportBooked: !td.transportBooked })}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${td.transportBooked ? 'bg-emerald-500 flex justify-end' : 'bg-slate-200 flex justify-start'}`}
                          >
                            <span className="w-4 h-4 bg-white rounded-full shadow-sm block"></span>
                          </button>
                        </div>
                      </div>

                      {/* Dining / Food Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Utensils size={16} /></div>
                            <h5 className="font-bold text-xs text-slate-800">Dining & Food</h5>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={td.foodCost || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ foodCost: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500 focus:bg-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dining Plan & Notes</label>
                              <textarea 
                                value={td.foodNotes || ''} 
                                onChange={(e) => handleUpdateTripDetails({ foodNotes: e.target.value })}
                                placeholder="Breakfast included, estimated $60/day..." 
                                className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-[11px] font-medium focus:ring-1 focus:ring-sky-500 focus:bg-white h-24 resize-none" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sights & Excursions Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Compass size={16} /></div>
                            <h5 className="font-bold text-xs text-slate-800">Sites & Activities</h5>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={td.sitesCost || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ sitesCost: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500 focus:bg-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sights, Tickets & Excursions</label>
                              <textarea 
                                value={td.sitesNotes || ''} 
                                onChange={(e) => handleUpdateTripDetails({ sitesNotes: e.target.value })}
                                placeholder="Snorkeling tour, museum entry, guided hikes..." 
                                className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-[11px] font-medium focus:ring-1 focus:ring-sky-500 focus:bg-white h-24 resize-none" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Savings & Booking Workflow Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    
                    {/* Strategy Selection Card */}
                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl text-white lg:col-span-1 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-4 flex items-center gap-1.5"><Tag size={12} /> Funding Strategy</h4>
                        <div className="space-y-3">
                          <button 
                            type="button"
                            onClick={() => handleUpdateTripDetails({ savingMode: 'save' })}
                            className={`w-full p-4 rounded-xl text-left border transition-all flex items-start gap-3 ${td.savingMode === 'save' ? 'border-sky-500 bg-sky-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                          >
                            <span className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${td.savingMode === 'save' ? 'border-sky-400 text-sky-400' : 'border-white/20'}`}>
                              {td.savingMode === 'save' && <span className="w-2 h-2 rounded-full bg-sky-400 block" />}
                            </span>
                            <div>
                              <h5 className="font-bold text-xs text-white">Save For Trip</h5>
                              <p className="text-[10px] text-slate-400 mt-1 leading-tight">I need to accumulate savings weekly/monthly towards this goal.</p>
                            </div>
                          </button>

                          <button 
                            type="button"
                            onClick={() => handleUpdateTripDetails({ savingMode: 'book' })}
                            className={`w-full p-4 rounded-xl text-left border transition-all flex items-start gap-3 ${td.savingMode === 'book' ? 'border-sky-500 bg-sky-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                          >
                            <span className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${td.savingMode === 'book' ? 'border-sky-400 text-sky-400' : 'border-white/20'}`}>
                              {td.savingMode === 'book' && <span className="w-2 h-2 rounded-full bg-sky-400 block" />}
                            </span>
                            <div>
                              <h5 className="font-bold text-xs text-white">Ready to Book / Secure</h5>
                              <p className="text-[10px] text-slate-400 mt-1 leading-tight">I have the funds ready. Move to locking in bookings.</p>
                            </div>
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-8 text-[9px] text-slate-500 leading-normal border-t border-white/5 pt-4">
                        Strategy is synced to your financial dashboard. Saving schedules adjust dynamically.
                      </div>
                    </div>

                    {/* Detailed Interactive Panel for Selected Strategy */}
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl lg:col-span-2 shadow-sm">
                      {td.savingMode === 'save' ? (
                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Clock size={14} className="text-sky-500" /> Savings Schedule & Milestones</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-150">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Travel Date</label>
                                <input 
                                  type="date" 
                                  value={td.targetDate || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ targetDate: e.target.value })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500" 
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amount Saved So Far ($)</label>
                                <input 
                                  type="number" 
                                  value={td.amountSaved || ''} 
                                  onChange={(e) => handleUpdateTripDetails({ amountSaved: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500" 
                                />
                              </div>
                            </div>

                            <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                              {td.targetDate ? (
                                <div className="space-y-3">
                                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                                    <span>Time Left:</span>
                                    <span className="font-bold text-slate-800">{daysLeft} Days ({weeksLeft} Weeks / {monthsLeft} Months)</span>
                                  </div>
                                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-200/50">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Weekly Goal</span>
                                    <span className="text-lg font-black text-slate-800">${weeklySavings.toLocaleString()}<span className="text-xs font-normal text-slate-400">/week</span></span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Monthly Goal</span>
                                    <span className="text-lg font-black text-slate-800">${monthlySavings.toLocaleString()}<span className="text-xs font-normal text-slate-400">/month</span></span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 py-6">
                                  <AlertCircle size={18} className="mb-1.5 text-slate-300" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider leading-snug">Set Travel Date</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">Define travel date to automatically calculate your required savings rate.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Goal Progress</span>
                              <span className="text-xs font-bold text-sky-600">{progressPct}% Secured (${td.amountSaved.toLocaleString()} of ${totalCost.toLocaleString()})</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div 
                                className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full transition-all duration-500" 
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Integrated Savings Quick Contribution */}
                          <div className="bg-sky-50/50 border border-sky-100 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                              <h5 className="font-bold text-xs text-sky-900 flex items-center gap-1"><Sparkles size={12} className="text-sky-500" /> Quick Deposit Tracker</h5>
                              <p className="text-[10px] text-sky-700/80 leading-normal">Instantly record savings towards this trip. It logs in the trip ledger automatically.</p>
                            </div>
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                const amtInput = e.currentTarget.elements.namedItem('depositAmount') as HTMLInputElement;
                                const amt = parseFloat(amtInput?.value) || 0;
                                if (amt <= 0) return;

                                // Update amountSaved
                                const updatedSaved = td.amountSaved + amt;
                                
                                // Create internal ledger transaction item
                                const newItem: EventItem = {
                                  id: generateId(),
                                  description: `Savings Contribution: Trip to ${td.destination}`,
                                  amount: amt,
                                  type: 'income',
                                  category: 'Tickets',
                                  date: new Date().toISOString().split('T')[0]
                                };
                                const updatedEvent = {
                                  ...selectedEvent,
                                  tripDetails: {
                                    ...td,
                                    amountSaved: updatedSaved
                                  },
                                  items: [...(selectedEvent.items || []), newItem],
                                  lastUpdated: new Date().toISOString()
                                };
                                onUpdateEvent(updatedEvent);
                                addActionLog(updatedEvent, `Logged savings contribution: $${amt}`, 'transaction');
                                e.currentTarget.reset();
                              }} 
                              className="flex gap-2 w-full md:w-auto"
                            >
                              <div className="relative flex-1 md:w-32">
                                <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  name="depositAmount"
                                  type="number" 
                                  placeholder="Deposit" 
                                  required
                                  className="w-full pl-6 pr-2 py-1.5 bg-white border border-sky-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-sky-500" 
                                />
                              </div>
                              <button type="submit" className="px-4 py-1.5 bg-sky-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:bg-sky-500 transition">Save</button>
                            </form>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6 h-full flex flex-col justify-between">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Booking Status Tracker</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Funding is secure! Track your checkout status. Toggle items as you book flights, hotels, and vehicles.</p>
                            
                            <div className="space-y-3 pt-2">
                              {/* Flight booking checker */}
                              <div className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${td.flightBooked ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${td.flightBooked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Plane size={14} /></div>
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-800">Lock in Flights</h5>
                                    <p className="text-[10px] text-slate-400 leading-tight">{td.flightNotes || 'No airline details specified.'}</p>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleUpdateTripDetails({ flightBooked: !td.flightBooked })}
                                  className={`px-3 py-1 text-[9px] font-bold uppercase rounded border transition-all ${td.flightBooked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                                >
                                  {td.flightBooked ? 'Booked ✓' : 'To Book'}
                                </button>
                              </div>

                              {/* Accommodation booking checker */}
                              <div className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${td.accommodationBooked ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${td.accommodationBooked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Hotel size={14} /></div>
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-800">Secure Accommodation</h5>
                                    <p className="text-[10px] text-slate-400 leading-tight">{td.accommodationNotes || 'No lodging details specified.'}</p>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleUpdateTripDetails({ accommodationBooked: !td.accommodationBooked })}
                                  className={`px-3 py-1 text-[9px] font-bold uppercase rounded border transition-all ${td.accommodationBooked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                                >
                                  {td.accommodationBooked ? 'Booked ✓' : 'To Book'}
                                </button>
                              </div>

                              {/* Transport booking checker */}
                              <div className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${td.transportBooked ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${td.transportBooked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Car size={14} /></div>
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-800">Reserve Transport ({td.transportType})</h5>
                                    <p className="text-[10px] text-slate-400 leading-tight">{td.transportNotes || 'No ground travel details specified.'}</p>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleUpdateTripDetails({ transportBooked: !td.transportBooked })}
                                  className={`px-3 py-1 text-[9px] font-bold uppercase rounded border transition-all ${td.transportBooked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                                >
                                  {td.transportBooked ? 'Booked ✓' : 'To Book'}
                                </button>
                              </div>
                            </div>
                          </div>

                          {td.flightBooked && td.accommodationBooked && td.transportBooked ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 flex items-center gap-3 text-xs font-semibold animate-in zoom-in-95 mt-4">
                              <span>🎉</span>
                              <div>
                                <p className="font-bold">All Bookings Confirmed!</p>
                                <p className="text-[10px] text-emerald-600 mt-0.5">Your trip is fully prepped and verified. Head to the Checklist tab to finish packing!</p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl text-sky-850 flex items-center gap-3 text-xs mt-4">
                              <Info size={16} className="text-sky-500 shrink-0" />
                              <p className="text-[10px] leading-normal text-sky-700">Once flights, accommodations, and transport are booked, you are ready for travel! Finish checking them off to unlock the full trip dashboard confirmation.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

            {activeTab === 'startup_planner' && selectedEvent.startupDetails && (() => {
              const sd = selectedEvent.startupDetails;
              
              // Sale Price Calculator Fallback / Safe Initialization
              const productionItems = sd.productionItems || [];
              const derivedUnits = sd.derivedUnits !== undefined ? sd.derivedUnits : 1;
              const hourlyRate = sd.hourlyRate !== undefined ? sd.hourlyRate : 20;
              const laborHours = sd.laborHours !== undefined ? sd.laborHours : 5;
              const desiredProfitType = sd.desiredProfitType || 'percentage';
              const desiredProfitValue = sd.desiredProfitValue !== undefined ? sd.desiredProfitValue : 50;
              const includeVat = !!sd.includeVat;
              const includeLevy = !!sd.includeLevy;
              const contingencyPercent = sd.contingencyPercent !== undefined ? sd.contingencyPercent : 5;
              const allocateOverhead = !!sd.allocateOverhead;

              // Calculations
              // 1. Materials
              const totalMaterialsCost = productionItems.reduce((sum, item) => sum + (item.cost || 0), 0);
              const materialsCostPerUnit = derivedUnits > 0 ? totalMaterialsCost / derivedUnits : 0;
              const contingencyCostPerUnit = materialsCostPerUnit * (contingencyPercent / 100);
              const finalMaterialsCostPerUnit = materialsCostPerUnit + contingencyCostPerUnit;

              // 2. Labor
              const totalLaborCost = hourlyRate * laborHours;
              const laborCostPerUnit = derivedUnits > 0 ? totalLaborCost / derivedUnits : 0;

              // 3. Allocated Overhead
              const monthlyOpExpenses = sd.rent + sd.salaries + sd.marketing + sd.utilities + sd.otherExpenses;
              const monthlyVolumeUnits = sd.monthlyVolume || 1;
              const allocatedOverheadPerUnit = (allocateOverhead && monthlyVolumeUnits > 0) ? (monthlyOpExpenses / monthlyVolumeUnits) : 0;

              // 4. Calculated Unit Production Cost (Calculated COGS)
              const calculatedCogs = parseFloat((finalMaterialsCostPerUnit + laborCostPerUnit + allocatedOverheadPerUnit).toFixed(2));

              // 5. Desired Profit
              let calculatedProfitPerUnit = 0;
              if (desiredProfitType === 'percentage') {
                calculatedProfitPerUnit = calculatedCogs * (desiredProfitValue / 100);
              } else {
                calculatedProfitPerUnit = desiredProfitValue;
              }
              calculatedProfitPerUnit = parseFloat(calculatedProfitPerUnit.toFixed(2));

              // 6. Pre-Tax Selling Price
              const preTaxSellingPrice = parseFloat((calculatedCogs + calculatedProfitPerUnit).toFixed(2));

              // 7. Taxes & Levies
              const levyCost = includeLevy ? parseFloat((preTaxSellingPrice * 0.025).toFixed(2)) : 0;
              const vatCost = includeVat ? parseFloat((preTaxSellingPrice * 0.125).toFixed(2)) : 0;

              // 8. Final Suggested Retail Price
              const finalSuggestedPrice = parseFloat((preTaxSellingPrice + levyCost + vatCost).toFixed(2));

              // Integration logic: Use calculated price values if dynamic costing is in place
              const hasDynamicCosting = productionItems.length > 0 || laborHours > 0 || allocateOverhead;
              
              const costOfGoodsSoldUnit = hasDynamicCosting ? calculatedCogs : sd.cogs;
              const markupPercent = hasDynamicCosting 
                ? (desiredProfitType === 'percentage' ? desiredProfitValue : parseFloat(((calculatedProfitPerUnit / (calculatedCogs || 1)) * 100).toFixed(1)))
                : sd.markup;

              const sellingPrice = hasDynamicCosting ? finalSuggestedPrice : parseFloat((costOfGoodsSoldUnit * (1 + markupPercent / 100)).toFixed(2));
              
              const monthlyCOGS = costOfGoodsSoldUnit * monthlyVolumeUnits;
              const monthlyRevenue = sellingPrice * monthlyVolumeUnits;
              const monthlyGrossProfit = monthlyRevenue - monthlyCOGS;
              const monthlyUnits = monthlyVolumeUnits;
              
              const monthlyNetOperatingProfit = monthlyGrossProfit - monthlyOpExpenses;
              const grossMarginPercent = monthlyRevenue > 0 ? Math.round((monthlyGrossProfit / monthlyRevenue) * 100) : 0;
              const netMarginPercent = monthlyRevenue > 0 ? Math.round((monthlyNetOperatingProfit / monthlyRevenue) * 100) : 0;

              // Projections Growth Rates
              const g3 = 1 + sd.growthRateYear3 / 100;
              const g5 = 1 + sd.growthRateYear5 / 100;

              // Year 1, Year 3, Year 5 projections
              const y1Rev = monthlyRevenue * 12;
              const y1COGS = monthlyCOGS * 12;
              const y1Gross = y1Rev - y1COGS;
              const y1OpEx = monthlyOpExpenses * 12;
              const y1Net = y1Gross - y1OpEx;

              const y3Rev = y1Rev * g3;
              const y3COGS = y1COGS * g3;
              const y3Gross = y3Rev - y3COGS;
              const y3OpEx = y1OpEx * 1.08; // 8% operating scaling inflation
              const y3Net = y3Gross - y3OpEx;

              const y5Rev = y1Rev * g5;
              const y5COGS = y1COGS * g5;
              const y5Gross = y5Rev - y5COGS;
              const y5OpEx = y1OpEx * 1.15; // 15% operating scaling inflation
              const y5Net = y5Gross - y5OpEx;

              const handleUpdateStartup = (fields: Partial<typeof selectedEvent.startupDetails>) => {
                if (!selectedEvent || !selectedEvent.startupDetails) return;
                onUpdateEvent({
                  ...selectedEvent,
                  startupDetails: {
                    ...selectedEvent.startupDetails,
                    ...fields
                  },
                  lastUpdated: new Date().toISOString()
                });
              };

              const handleAddMaterial = () => {
                if (!calcItemName.trim()) return;
                const newItem = {
                  id: generateId(),
                  name: calcItemName.trim(),
                  cost: parseFloat(calcItemCost) || 0
                };
                handleUpdateStartup({ 
                  productionItems: [...productionItems, newItem] 
                });
                setCalcItemName('');
                setCalcItemCost('');
              };

              const handleRemoveMaterial = (itemId: string) => {
                const updated = productionItems.filter(item => item.id !== itemId);
                handleUpdateStartup({ productionItems: updated });
              };

              return (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Financial projections banner */}
                  <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Caribbean Commercial Standard</span>
                      <h3 className="text-xl font-light">Startup: <span className="font-semibold text-emerald-300">{selectedEvent.name}</span></h3>
                      <p className="text-xs text-slate-400 mt-1 leading-normal">Interactive price models & multi-year commercial lending statements.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-center">
                        <span className="text-[8px] font-bold text-slate-400 uppercase block">Year 1 Net (Proj)</span>
                        <span className={`text-sm font-bold ${y1Net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${Math.round(y1Net).toLocaleString()}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-center">
                        <span className="text-[8px] font-bold text-slate-400 uppercase block">Year 5 Net (Proj)</span>
                        <span className={`text-sm font-bold ${y5Net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${Math.round(y5Net).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and operating expenses calculator */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Unit Pricing & Sale Price Calculator */}
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Calculator size={14} className="text-emerald-500" /> 
                          Interactive Sale Price Costing
                        </h4>
                        {hasDynamicCosting ? (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles size={10} /> Live-Linked
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Manual mode
                          </span>
                        )}
                      </div>

                      {/* Section 1: Raw Materials / Ingredients */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">1. Production Items / Materials List</label>
                          <span className="text-[10px] text-slate-600 font-bold">Total Batch Cost: ${totalMaterialsCost.toFixed(2)}</span>
                        </div>
                        
                        {/* Material List Items */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto">
                          {productionItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 text-center py-4">No materials listed yet. Use the fields below to add materials/ingredients.</p>
                          ) : (
                            <div className="divide-y divide-slate-200/60">
                              {productionItems.map((item) => (
                                <div key={item.id} className="flex justify-between items-center py-1.5 text-xs">
                                  <span className="text-slate-700 font-medium truncate max-w-[180px]">{item.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-900 font-semibold">${item.cost.toFixed(2)}</span>
                                    <button 
                                      type="button" 
                                      onClick={() => handleRemoveMaterial(item.id)} 
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                                      title="Remove item"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add material inputs */}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={calcItemName}
                            onChange={(e) => setCalcItemName(e.target.value)}
                            placeholder="e.g. Raw materials, Flour, Packaging" 
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white font-medium"
                          />
                          <div className="relative w-24">
                            <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={calcItemCost}
                              onChange={(e) => setCalcItemCost(e.target.value)}
                              placeholder="Cost" 
                              className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white font-medium"
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={handleAddMaterial}
                            disabled={!calcItemName.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-1.5 rounded flex items-center justify-center transition-all shadow-sm"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Section 2: Yield & Contingency */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">2. Batch Yield (Units Derived)</label>
                          <input 
                            type="number" 
                            min="1"
                            value={derivedUnits} 
                            onChange={(e) => handleUpdateStartup({ derivedUnits: Math.max(1, parseInt(e.target.value) || 1) })}
                            placeholder="e.g. 1" 
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Contingency / Waste (%)</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              max="100"
                              value={contingencyPercent} 
                              onChange={(e) => handleUpdateStartup({ contingencyPercent: Math.max(0, parseFloat(e.target.value) || 0) })}
                              placeholder="e.g. 5" 
                              className="w-full pr-6 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                            />
                            <span className="absolute right-2.5 top-2 text-slate-400 text-xs">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Labor Input */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block">3. Labor Cost (To Produce Batch)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Hourly Labor Rate ($/hr)</span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>
                              <input 
                                type="number" 
                                min="0"
                                value={hourlyRate} 
                                onChange={(e) => handleUpdateStartup({ hourlyRate: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Total Labor Hours (hrs)</span>
                            <input 
                              type="number" 
                              min="0"
                              step="0.1"
                              value={laborHours} 
                              onChange={(e) => handleUpdateStartup({ laborHours: Math.max(0, parseFloat(e.target.value) || 0) })}
                              placeholder="Hours" 
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Desired Profit & Overheads */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">4. Desired Profit Target</label>
                          <div className="flex gap-1 bg-slate-100 p-0.5 rounded text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateStartup({ desiredProfitType: 'percentage' })}
                              className={`px-1.5 py-0.5 rounded ${desiredProfitType === 'percentage' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                            >
                              Markup %
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStartup({ desiredProfitType: 'fixed' })}
                              className={`px-1.5 py-0.5 rounded ${desiredProfitType === 'fixed' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                            >
                              Fixed $
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">
                              {desiredProfitType === 'percentage' ? 'Profit Markup (%)' : 'Desired Unit Profit ($)'}
                            </span>
                            <div className="relative">
                              {desiredProfitType === 'fixed' && <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>}
                              <input 
                                type="number" 
                                min="0"
                                value={desiredProfitValue} 
                                onChange={(e) => handleUpdateStartup({ desiredProfitValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className={`w-full py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white ${desiredProfitType === 'fixed' ? 'pl-6 pr-2' : 'px-2.5'}`} 
                              />
                              {desiredProfitType === 'percentage' && <span className="absolute right-2.5 top-2 text-slate-400 text-xs">%</span>}
                            </div>
                          </div>

                          <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 cursor-pointer py-1">
                              <input 
                                type="checkbox"
                                checked={allocateOverhead}
                                onChange={(e) => handleUpdateStartup({ allocateOverhead: e.target.checked })}
                                className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                              />
                              <div>
                                <span className="text-[10px] font-bold text-slate-600 block">Allocate Overheads</span>
                                <span className="text-[8px] text-slate-400 leading-none">Share fixed monthly costs</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Taxes & Levies */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block">5. Taxes & Legal Levies</label>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={includeVat}
                              onChange={(e) => handleUpdateStartup({ includeVat: e.target.checked })}
                              className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                            />
                            <div>
                              <span className="text-[10px] font-bold text-slate-700 block">VAT (12.5%)</span>
                              <span className="text-[8px] text-slate-400 leading-none">Standard indirect tax</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={includeLevy}
                              onChange={(e) => handleUpdateStartup({ includeLevy: e.target.checked })}
                              className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                            />
                            <div>
                              <span className="text-[10px] font-bold text-slate-700 block">Health & Safety Levy (2.5%)</span>
                              <span className="text-[8px] text-slate-400 leading-none">Local safety surcharge</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Section 6: Receipt Breakdown */}
                      <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-3 font-mono shadow-inner border border-slate-800">
                        <div className="text-center pb-2 border-b border-dashed border-slate-700">
                          <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Unit Pricing Receipt</p>
                          <p className="text-[8px] text-slate-400">Caribbean Commercial Standards</p>
                        </div>
                        
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Raw Material / Unit:</span>
                            <span>${materialsCostPerUnit.toFixed(2)}</span>
                          </div>
                          
                          {contingencyPercent > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Contingency ({contingencyPercent}%):</span>
                              <span>+${contingencyCostPerUnit.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <span className="text-slate-400">Direct Labor / Unit:</span>
                            <span>+${laborCostPerUnit.toFixed(2)}</span>
                          </div>

                          {allocateOverhead && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Allocated Overhead:</span>
                              <span>+${allocatedOverheadPerUnit.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-bold text-emerald-300 pt-1 border-t border-slate-800 text-xs">
                            <span>Cost of Goods (COGS):</span>
                            <span>${calculatedCogs.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between text-slate-300 pt-1">
                            <span>Desired Profit:</span>
                            <span>+${calculatedProfitPerUnit.toFixed(2)} ({desiredProfitType === 'percentage' ? `${desiredProfitValue}%` : `$${desiredProfitValue} unit`})</span>
                          </div>

                          <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
                            <span>Pre-Tax Selling Price:</span>
                            <span>${preTaxSellingPrice.toFixed(2)}</span>
                          </div>

                          {includeLevy && (
                            <div className="flex justify-between text-rose-300">
                              <span>Health & Safety (2.5%):</span>
                              <span>+${levyCost.toFixed(2)}</span>
                            </div>
                          )}

                          {includeVat && (
                            <div className="flex justify-between text-rose-300">
                              <span>VAT (12.5%):</span>
                              <span>+${vatCost.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-bold text-emerald-400 pt-2 border-t border-dashed border-slate-700 text-sm">
                            <span>FINAL SALE PRICE:</span>
                            <span className="text-base font-black">${finalSuggestedPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Manual configuration override */}
                      {hasDynamicCosting && (
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Reset pricing calculator and switch back to manual entry mode?")) {
                                handleUpdateStartup({
                                  productionItems: [],
                                  laborHours: 0,
                                  allocateOverhead: false,
                                  includeVat: false,
                                  includeLevy: false
                                });
                              }
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Reset Pricing Builder & Use Manual Entry
                          </button>
                        </div>
                      )}

                      {/* Fallback Manual input fields if they are not using dynamic costing */}
                      {!hasDynamicCosting && (
                        <div className="border-t border-slate-100 pt-4 space-y-4">
                          <p className="text-[10px] text-slate-400 italic">No materials or labor logged. Using standard manual pricing fields below:</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manual Production Cost (COGS) ($)</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>
                                <input 
                                  type="number" 
                                  value={sd.cogs || ''} 
                                  onChange={(e) => handleUpdateStartup({ cogs: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00" 
                                  className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manual Markup (%)</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={sd.markup || ''} 
                                  onChange={(e) => handleUpdateStartup({ markup: parseFloat(e.target.value) || 0 })}
                                  placeholder="e.g. 50" 
                                  className="w-full pr-6 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                                />
                                <span className="absolute right-2.5 top-2 text-slate-400 text-xs">%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Target Monthly Volume (Units)</label>
                        <input 
                          type="number" 
                          value={sd.monthlyVolume || ''} 
                          onChange={(e) => handleUpdateStartup({ monthlyVolume: parseInt(e.target.value) || 0 })}
                          placeholder="e.g. 500" 
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <div>
                          <p className="text-slate-400 font-medium text-[10px]">Monthly Revenue:</p>
                          <p className="font-bold text-slate-800">${Math.round(monthlyRevenue).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium text-[10px]">Gross Margin %:</p>
                          <p className="font-bold text-slate-800">{grossMarginPercent}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Operating Expenses */}
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-500" /> Monthly Fixed Operating Expenses</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Rent / Workspace</label>
                          <input 
                            type="number" 
                            value={sd.rent || ''} 
                            onChange={(e) => handleUpdateStartup({ rent: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Salaries / Payroll</label>
                          <input 
                            type="number" 
                            value={sd.salaries || ''} 
                            onChange={(e) => handleUpdateStartup({ salaries: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Marketing / Promo</label>
                          <input 
                            type="number" 
                            value={sd.marketing || ''} 
                            onChange={(e) => handleUpdateStartup({ marketing: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Utilities / Tech</label>
                          <input 
                            type="number" 
                            value={sd.utilities || ''} 
                            onChange={(e) => handleUpdateStartup({ utilities: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Other / Miscellaneous Expenses</label>
                          <input 
                            type="number" 
                            value={sd.otherExpenses || ''} 
                            onChange={(e) => handleUpdateStartup({ otherExpenses: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1, 3, and 5 Year P&L Statement */}
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><FileText size={14} className="text-emerald-500" /> Multi-Year Profit & Loss Projections</h4>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Compliant presentation for Commercial Banks, Credit Unions, or Caribbean Export Development Agency grants.</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={async () => {
                          const docContent = `
                            <h2>Commercial Loan Proposal - Startup Projections</h2>
                            <h3>Plan Name: ${selectedEvent.name}</h3>
                            <p>Prepared for Commercial Credit Committee Evaluation</p>
                            <hr />
                            <h3>Pricing Strategy & Product Model</h3>
                            <ul>
                              <li><strong>Cost of Goods (per unit):</strong> $${costOfGoodsSoldUnit.toFixed(2)}</li>
                              <li><strong>Determined Retail Price:</strong> $${sellingPrice.toFixed(2)} (Markup: ${markupPercent}%)</li>
                              <li><strong>Target Monthly Volume:</strong> ${monthlyUnits} units</li>
                              <li><strong>Monthly Gross Margin:</strong> ${grossMarginPercent}%</li>
                            </ul>
                            <h3>Multi-Year Projections</h3>
                            <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; border: 1px solid #ddd; font-family: sans-serif; font-size: 13px;">
                              <thead>
                                <tr style="background: #f5f5f5;">
                                  <th>Revenue Line Statement</th>
                                  <th>Year 1</th>
                                  <th>Year 3 (x${g3} Vol)</th>
                                  <th>Year 5 (x${g5} Vol)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td><strong>Gross revenue (Units x Price)</strong></td>
                                  <td>$${Math.round(y1Rev).toLocaleString()}</td>
                                  <td>$${Math.round(y3Rev).toLocaleString()}</td>
                                  <td>$${Math.round(y5Rev).toLocaleString()}</td>
                                </tr>
                                <tr>
                                  <td>Cost of Goods Sold (COGS)</td>
                                  <td>$${Math.round(y1COGS).toLocaleString()}</td>
                                  <td>$${Math.round(y3COGS).toLocaleString()}</td>
                                  <td>$${Math.round(y5COGS).toLocaleString()}</td>
                                </tr>
                                <tr style="font-weight: bold; background: #eefdf5;">
                                  <td>Gross Profit Margin</td>
                                  <td>$${Math.round(y1Gross).toLocaleString()}</td>
                                  <td>$${Math.round(y3Gross).toLocaleString()}</td>
                                  <td>$${Math.round(y5Gross).toLocaleString()}</td>
                                </tr>
                                <tr>
                                  <td>Operating Expenses (Fixed & Variable)</td>
                                  <td>$${Math.round(y1OpEx).toLocaleString()}</td>
                                  <td>$${Math.round(y3OpEx).toLocaleString()}</td>
                                  <td>$${Math.round(y5OpEx).toLocaleString()}</td>
                                </tr>
                                <tr style="font-weight: bold; background: #e3faf0; border-top: 2px solid #000;">
                                  <td>Net Operating Profit (EBIT)</td>
                                  <td>$${Math.round(y1Net).toLocaleString()}</td>
                                  <td>$${Math.round(y3Net).toLocaleString()}</td>
                                  <td>$${Math.round(y5Net).toLocaleString()}</td>
                                </tr>
                                <tr style="font-size: 11px; color: #555;">
                                  <td>Operating Net Margin %</td>
                                  <td>${netMarginPercent}%</td>
                                  <td>${Math.round((y3Net / y3Rev) * 100)}%</td>
                                  <td>${Math.round((y5Net / y5Rev) * 100)}%</td>
                                </tr>
                              </tbody>
                            </table>
                            <p style="font-size: 10px; color: #999; margin-top: 15px;">Statement is mathematically generated using interactive pricing parameters.</p>
                          `;
                          
                          try {
                            await handleSaveDocument(`${selectedEvent.name} Loan Projections`, docContent, '.fdoc');
                            alert("Loan Projections exported to Documents! You can open it in the Vault/Documents tab.");
                          } catch (err) {
                            alert("Failed to export projections.");
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 transition-all shrink-0"
                      >
                        <Sparkles size={12} />
                        Export P&L to Documents
                      </button>
                    </div>

                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] bg-slate-50">
                            <th className="py-3 px-4">Revenue Statement Item</th>
                            <th className="py-3 px-4">Year 1</th>
                            <th className="py-3 px-4">Year 3 (+{sd.growthRateYear3}% vol)</th>
                            <th className="py-3 px-4">Year 5 (+{sd.growthRateYear5}% vol)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-semibold text-slate-800">Gross revenue</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y1Rev).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y3Rev).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y5Rev).toLocaleString()}</td>
                          </tr>
                          <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 px-4 text-slate-500">Cost of Goods Sold (COGS)</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y1COGS).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y3COGS).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y5COGS).toLocaleString()}</td>
                          </tr>
                          <tr className="border-b border-slate-150 font-bold bg-emerald-50/20 text-emerald-900">
                            <td className="py-3 px-4 text-emerald-800">Gross Profit Margin</td>
                            <td className="py-3 px-4">${Math.round(y1Gross).toLocaleString()}</td>
                            <td className="py-3 px-4">${Math.round(y3Gross).toLocaleString()}</td>
                            <td className="py-3 px-4">${Math.round(y5Gross).toLocaleString()}</td>
                          </tr>
                          <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 px-4 text-slate-500">Operating Expenses</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y1OpEx).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y3OpEx).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-700">${Math.round(y5OpEx).toLocaleString()}</td>
                          </tr>
                          <tr className="font-extrabold bg-emerald-100/30 text-emerald-950 text-sm border-b border-emerald-200">
                            <td className="py-4 px-4 text-emerald-900">Net Operating Profit</td>
                            <td className="py-4 px-4">${Math.round(y1Net).toLocaleString()}</td>
                            <td className="py-4 px-4">${Math.round(y3Net).toLocaleString()}</td>
                            <td className="py-4 px-4">${Math.round(y5Net).toLocaleString()}</td>
                          </tr>
                          <tr className="text-[10px] text-slate-400 bg-slate-50">
                            <td className="py-2.5 px-4">EBIT Margin %</td>
                            <td className="py-2.5 px-4">{netMarginPercent}%</td>
                            <td className="py-2.5 px-4">{y3Rev > 0 ? Math.round((y3Net / y3Rev) * 100) : 0}%</td>
                            <td className="py-2.5 px-4">{y5Rev > 0 ? Math.round((y5Net / y5Rev) * 100) : 0}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Projections controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-150 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Year 3 Growth Estimate (+%)</label>
                        <input 
                          type="number" 
                          value={sd.growthRateYear3 || ''} 
                          onChange={(e) => handleUpdateStartup({ growthRateYear3: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-emerald-500" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Year 5 Growth Estimate (+%)</label>
                        <input 
                          type="number" 
                          value={sd.growthRateYear5 || ''} 
                          onChange={(e) => handleUpdateStartup({ growthRateYear5: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-emerald-500" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'vault' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[500px]">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Encrypted Vault Assets</h3>
                    <div className="flex gap-2">
                      <button onClick={() => { setIsEditingSheet(true); setCurrentDoc(null); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-emerald-500 transition">
                        <i className="fas fa-table mr-1.5"></i> New Sheet
                      </button>
                      <button onClick={() => { setIsEditingDoc(true); setCurrentDoc(null); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-500 transition">
                        <i className="fas fa-file-pen mr-1.5"></i> New Doc
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {(selectedEvent.files || []).map(file => {
                      const isSheet = file.name.endsWith('.fcel') || file.type === 'application/fire-cell';
                      const isDoc = file.name.endsWith('.fdoc') || file.type === 'application/fire-doc';
                      const isInternal = file.storageType === 'indexeddb';
                      
                      return (
                        <div key={file.id} className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center text-center group cursor-pointer hover:border-indigo-500 transition-all shadow-sm" onClick={() => handleAssetClick(file)}>
                          <div className={`w-12 h-12 rounded flex items-center justify-center shadow-sm mb-4 group-hover:scale-105 transition-transform ${isSheet ? 'bg-emerald-600 text-white' : (isDoc ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-slate-250')}`}>
                            <i className={`fas ${isSheet ? 'fa-table' : (isDoc ? 'fa-file-lines' : 'fa-file-invoice')} text-lg`}></i>
                          </div>
                          <p className="font-bold text-[11px] text-slate-800 truncate w-full mb-1">{file.name}</p>
                          <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${isInternal ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                            {isInternal ? 'SECURE_VAULT' : 'MIRROR_DRIVE'}
                          </span>
                        </div>
                      );
                    })}
                    <div className="p-5 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer transition-all" onClick={() => fileInputRef.current?.click()}>
                      <i className="fas fa-file-circle-plus text-lg mb-2"></i>
                      <span className="text-[9px] font-bold uppercase tracking-wider">Link Physical</span>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Internal Finance</h3>
                  <div className="space-y-3">
                    {selectedEvent.items.length > 0 ? selectedEvent.items.map(item => (
                      <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded flex items-center justify-center text-white ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                            <i className={`fas ${item.type === 'income' ? 'fa-plus' : 'fa-minus'} text-xs`}></i>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{item.description}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.category} • {item.date}</p>
                          </div>
                        </div>
                        <p className={`font-bold text-sm ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                        </p>
                      </div>
                    )) : <p className="text-center py-10 text-slate-355 uppercase font-bold text-[10px] tracking-wider">No Transactions</p>}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-sm">
                  <h3 className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-6">Authorize Entry</h3>
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <input name="description" placeholder="Description" required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" />
                    <input name="amount" type="number" step="0.01" placeholder="Amount" required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" />
                    <select name="type" className="w-full bg-slate-850 border border-white/10 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300">
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <select name="category" className="w-full bg-slate-850 border border-white/10 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300">
                      {EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider">Commit Entry</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {(selectedEvent.tasks || []).length > 0 ? (selectedEvent.tasks || []).map(task => (
                    <div key={task.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleTaskCompletion(task.id)}
                            className={`w-8 h-8 rounded flex items-center justify-center border transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-slate-300 hover:border-indigo-400'}`}
                          >
                            <i className="fas fa-check text-xs"></i>
                          </button>
                          <div>
                            <p className={`font-semibold text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.text}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assigned: {task.assignedToId}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Subtasks */}
                      <div className="ml-11 space-y-2">
                        {(task.subTasks || []).map(st => (
                          <div key={st.id} className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleTaskCompletion(st.id, task.id)}
                              className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-slate-250'}`}
                            >
                              <i className="fas fa-check text-[7px]"></i>
                            </button>
                            <p className={`text-xs font-medium ${st.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{st.text}</p>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
                          <input 
                            type="text" 
                            placeholder="Link sub-milestone..."
                            value={subTaskInputs[task.id] || ''}
                            onChange={(e) => setSubTaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask(task.id)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button 
                            onClick={() => handleAddSubTask(task.id)}
                            className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-bold"
                          >
                            <i className="fas fa-plus text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="bg-white p-12 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                      <i className="fas fa-clipboard-list text-slate-200 text-4xl mb-4"></i>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Active Phases</p>
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                   <h3 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-4">Deploy Milestone</h3>
                   <textarea 
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    placeholder="Enter project milestone..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 h-28 mb-3"
                   />
                   <button 
                    onClick={handleAddTask}
                    className="w-full py-2 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow-sm"
                   >
                    Initialize Phase
                   </button>
                </div>
               </div>
            )}

            {activeTab === 'team' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(selectedEvent.memberUsernames || []).map(username => (
                    <div key={username} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center font-bold uppercase border border-indigo-150">
                          {username[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{username}</p>
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Authorized Access</span>
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-user-minus text-xs"></i></button>
                    </div>
                  ))}
                  <div className="bg-slate-50 border border-dashed border-slate-250 rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-60">
                     <i className="fas fa-user-plus text-slate-300 text-lg mb-1"></i>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Recruitment</p>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-sm h-fit">
                   <h3 className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-4">Project Access Control</h3>
                   <p className="text-xs text-slate-400 mb-4 font-medium">Add collaborators by their vault identity to grant them shared intelligence access.</p>
                   <input 
                    type="text" 
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Search designation..."
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 mb-3"
                   />
                   <button 
                    onClick={handleAddMember}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                   >
                    Link Identity
                   </button>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Linked Stakeholders</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {contacts.filter(c => (selectedEvent.contactIds || []).includes(c.id)).map(contact => (
                        <div key={contact.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white border border-slate-250 rounded flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-id-badge text-sm"></i></div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{contact.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{contact.number}</p>
                            </div>
                          </div>
                          <button onClick={() => handleUnlinkContact(contact.id)} className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><i className="fas fa-unlink text-xs"></i></button>
                        </div>
                      ))}
                      {contacts.filter(c => (selectedEvent.contactIds || []).includes(c.id)).length === 0 && (
                        <p className="col-span-2 py-8 text-center text-slate-300 uppercase font-bold text-[9px] tracking-wider">No Stakeholders Linked</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Global Stakeholder Directory</h3>
                      <input 
                        type="text" 
                        placeholder="Search directory..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                      />
                    </div>
                    <div className="space-y-2">
                      {contacts.filter(c => !(selectedEvent.contactIds || []).includes(c.id) && c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(contact => (
                        <div key={contact.id} className="p-3 bg-white border border-slate-150 rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-indigo-50 text-indigo-400 rounded flex items-center justify-center border border-indigo-100"><i className="fas fa-user text-[10px]"></i></div>
                            <span className="text-xs font-semibold text-slate-700">{contact.name}</span>
                          </div>
                          <button onClick={() => handleLinkContact(contact.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-[8px] font-bold uppercase tracking-wider">Link Project</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-sm h-fit">
                   <h3 className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-4">Register Stakeholder</h3>
                   <div className="space-y-3">
                      <input 
                        type="text" 
                        placeholder="Stakeholder Name" 
                        value={newContact.name} 
                        onChange={e => setNewContact({...newContact, name: e.target.value})} 
                        className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <input 
                        type="text" 
                        placeholder="Contact Number" 
                        value={newContact.number} 
                        onChange={e => setNewContact({...newContact, number: e.target.value})} 
                        className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <input 
                        type="email" 
                        placeholder="Stakeholder Email" 
                        value={newContact.email} 
                        onChange={e => setNewContact({...newContact, email: e.target.value})} 
                        className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <button 
                        onClick={handleCreateContact}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                      >
                        Commit to Vault
                      </button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Project Intelligence Feed</h3>
                <div className="space-y-6 relative">
                   <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-slate-100"></div>
                   {(selectedEvent.logs || []).length > 0 ? (selectedEvent.logs || []).map(log => (
                     <div key={log.id} className="flex gap-4 relative z-10">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-xs shadow-sm ${
                          log.type === 'transaction' ? 'bg-emerald-600 text-white' : 
                          log.type === 'task' ? 'bg-indigo-600 text-white' : 
                          log.type === 'file' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <i className={`fas ${
                            log.type === 'transaction' ? 'fa-receipt' : 
                            log.type === 'task' ? 'fa-check-double' : 
                            log.type === 'file' ? 'fa-database' : 'fa-info'
                          } text-xs`}></i>
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className="flex justify-between items-start mb-0.5">
                            <p className="font-semibold text-slate-800 text-sm leading-none">{log.action}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {log.username} • {new Date(log.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                     </div>
                   )) : (
                     <p className="text-center py-12 text-slate-200 uppercase font-bold text-xs tracking-wider">Feed Empty</p>
                   )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {events.map(event => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-600/50 hover:bg-slate-50/50 transition-all relative overflow-hidden group">
                <h3 className="font-bold text-slate-800 text-lg mb-2 group-hover:text-indigo-600 transition-colors">{event.name}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-6">Updated: {new Date(event.lastUpdated).toLocaleDateString()}</p>
                <div className="flex gap-2">
                  <span className="px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider border bg-indigo-50 border-indigo-100 text-indigo-600">{(event.files || []).length} Assets</span>
                  <span className="px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider border bg-slate-50 border-slate-100 text-slate-600">{(event.tasks || []).length} Phases</span>
                </div>
              </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default EventPlanner;
