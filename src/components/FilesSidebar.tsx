import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Image, Code, MoreVertical, Eye, Trash2, ChevronDown, CheckCircle, XCircle, ArrowLeft, UploadCloud, X, Plus, Loader2 } from 'lucide-react';
import { ChatMessage, Role, TunedModel, TuningStatus, Model, TrainingFile } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface FilesSidebarProps {
  isSidebarOpen: boolean;
  messages: ChatMessage[];
  onDeleteAttachment: (messageIndex: number, attachmentIndex: number) => void;
  tunedModels: TunedModel[];
  onStartTuning: (config: Omit<TunedModel, 'id' | 'status'>) => void;
  onUpdateTuning: (model: TunedModel) => void;
  onDeleteTunedModel: (modelId: string) => void;
  modelOptions: { value: Model; label: string }[];
  isMobile: boolean;
}

type ActiveTab = 'files' | 'tuning';

const LocalDropdown: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}> = ({ label, options, selectedValue, onSelect, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLabel = options.find(opt => opt.value === selectedValue)?.label || selectedValue;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg ${
          disabled
            ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
            : 'bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
        }`}
        disabled={disabled}
      >
        <span className={`text-sm truncate ${disabled ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto hover-scrollbar [scrollbar-gutter:stable]">
          {options.map(option => (
            <div
              key={option.value}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
              className="px-3 py-2 text-sm text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer truncate"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export const FilesSidebar: React.FC<FilesSidebarProps> = ({ isSidebarOpen, messages, onDeleteAttachment, tunedModels, onStartTuning, onUpdateTuning, onDeleteTunedModel, modelOptions, isMobile }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tuning');

  const TabButton = ({ tabId, children }: { tabId: ActiveTab; children: React.ReactNode }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-1/2 ${
            activeTab === tabId
                ? 'bg-white shadow-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
    >
        {children}
    </button>
  );

  const FilesTabContent: React.FC = () => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<{ messageIndex: number, attachmentIndex: number, name: string } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setActiveMenu(null);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
      
    const userUploads: { messageIndex: number; attachmentIndex: number; name: string; mimeType: string; dataUrl: string; }[] = [];
    const generatedFiles: { name: string; type: 'image' | 'code'; content: string; language?: string }[] = [];

    messages.forEach((msg, messageIndex) => {
        if (msg.role === Role.USER && msg.attachments) {
            msg.attachments.forEach((att, attachmentIndex) => userUploads.push({ messageIndex, attachmentIndex, ...att }));
        }

        if (msg.role === Role.MODEL) {
            const imageRegex = /!\[(.*?)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g;
            let imageMatch;
            while ((imageMatch = imageRegex.exec(msg.content)) !== null) {
                generatedFiles.push({
                    name: imageMatch[1] || `generated-image-${Date.now()}.png`,
                    type: 'image',
                    content: imageMatch[2],
                });
            }

            const codeRegex = /```(\w*)\n([\s\S]*?)\n```/g;
            let codeMatch;
            while ((codeMatch = codeRegex.exec(msg.content)) !== null) {
                const language = codeMatch[1] || 'text';
                const extension = language || 'txt';
                generatedFiles.push({
                    name: `code-snippet-${Date.now()}.${extension}`,
                    type: 'code',
                    content: codeMatch[2],
                    language: language,
                });
            }
        }
    });

    const openConfirmModal = (messageIndex: number, attachmentIndex: number, name: string) => {
        setFileToDelete({ messageIndex, attachmentIndex, name });
        setIsConfirmModalOpen(true);
        setActiveMenu(null);
    };

    const handleConfirmDelete = () => {
        if (fileToDelete) {
            onDeleteAttachment(fileToDelete.messageIndex, fileToDelete.attachmentIndex);
        }
        setIsConfirmModalOpen(false);
        setFileToDelete(null);
    };
    
    const handleDownload = (dataUrl: string, name: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setActiveMenu(null);
    };

    const handleCodeDownload = (content: string, name: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        handleDownload(url, name);
        URL.revokeObjectURL(url);
    };
    
    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
        if (mimeType.startsWith('text/')) return <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
        return <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    };

    if (userUploads.length === 0 && generatedFiles.length === 0) {
      return (
        <div className="text-center py-10">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No files found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Files from your chat will appear here.</p>
        </div>
      );
    }
    
    return (
        <div className="space-y-6">
            {userUploads.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">User Uploads</h3>
                    <ul className="space-y-1">
                        {userUploads.map((file, index) => (
                            <li key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                <div className="flex items-center gap-3 min-w-0">
                                    {getFileIcon(file.mimeType)}
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={file.name}>{file.name}</span>
                                </div>
                                <div className="relative">
                                    <button onClick={() => setActiveMenu(`user-${index}`)} data-tooltip-text="Options" data-tooltip-position="left" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full">
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {activeMenu === `user-${index}` && (
                                        <div ref={menuRef} className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                                            <button onClick={() => handleDownload(file.dataUrl, file.name)} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                                                <Download className="h-4 w-4"/> Download
                                            </button>
                                            <button onClick={() => openConfirmModal(file.messageIndex, file.attachmentIndex, file.name)} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <Trash2 className="h-4 w-4"/> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {generatedFiles.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Generated Files</h3>
                     <ul className="space-y-1">
                        {generatedFiles.map((file, index) => (
                            <li key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                <div className="flex items-center gap-3 min-w-0">
                                    {file.type === 'image' ? <Image className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : <Code className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={file.name}>{file.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {file.type === 'image' && <a href={file.content} target="_blank" rel="noopener noreferrer" data-tooltip-text="View" data-tooltip-position="left" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"><Eye className="h-4 w-4" /></a>}
                                    <button onClick={() => file.type === 'image' ? handleDownload(file.content, file.name) : handleCodeDownload(file.content, file.name)} data-tooltip-text="Download" data-tooltip-position="left" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full">
                                        <Download className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Attachment"
            >
                Are you sure you want to delete the file "{fileToDelete?.name}"? This will remove it from the chat message. This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
  };
  
  const TuningTabContent: React.FC = () => {
    type View = 'list' | 'form';
    const [view, setView] = useState<View>('list');
    const [editingModel, setEditingModel] = useState<TunedModel | null>(null);
    const [deletingModel, setDeletingModel] = useState<TunedModel | null>(null);

    const handleNew = () => {
        setEditingModel(null);
        setView('form');
    };

    const handleEdit = (model: TunedModel) => {
        setEditingModel(model);
        setView('form');
    };

    const handleSave = (config: Omit<TunedModel, 'id' | 'status'>, isUpdate: boolean) => {
        if (isUpdate && editingModel) {
            onUpdateTuning({ ...config, id: editingModel.id, status: TuningStatus.COMPLETED });
        } else {
            onStartTuning(config);
        }
        setView('list');
    };
    
    const handleDeleteConfirm = () => {
        if (deletingModel) {
            onDeleteTunedModel(deletingModel.id);
            setDeletingModel(null);
        }
    };
    
    const StatusIcon = ({ status }: { status: TuningStatus }) => {
        switch (status) {
            case TuningStatus.COMPLETED: return <CheckCircle className="h-5 w-5 text-green-500" />;
            case TuningStatus.TRAINING: return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
            case TuningStatus.FAILED: return <XCircle className="h-5 w-5 text-red-500" />;
            default: return null;
        }
    };

    if (view === 'form') {
      return (
        <TuningForm
          modelToEdit={editingModel}
          onSave={handleSave}
          onBack={() => setView('list')}
          modelOptions={modelOptions}
        />
      );
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">My Tuned Models</h3>
                <button onClick={handleNew} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    <Plus className="h-3 w-3" /> Create
                </button>
            </div>
            {tunedModels.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No tuned models yet</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create a new model to get started.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {tunedModels.map(model => (
                        <li key={model.id} className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                            <button onClick={() => handleEdit(model)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                                <StatusIcon status={model.status} />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{model.displayName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {model.status === TuningStatus.TRAINING ? 'Training...' : `Based on ${modelOptions.find(o => o.value === model.baseModel)?.label || model.baseModel}`}
                                    </p>
                                </div>
                            </button>
                            {model.status !== TuningStatus.TRAINING && (
                                <button
                                    onClick={() => setDeletingModel(model)}
                                    data-tooltip-text="Delete Model"
                                    data-tooltip-position="left"
                                    className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <ConfirmationModal
                isOpen={!!deletingModel}
                onClose={() => setDeletingModel(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Tuned Model"
            >
                Are you sure you want to delete the model "{deletingModel?.displayName}"? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
  };

  interface TuningFormProps {
    modelToEdit: TunedModel | null;
    onSave: (config: Omit<TunedModel, 'id' | 'status'>, isUpdate: boolean) => void;
    onBack: () => void;
    modelOptions: { value: Model; label: string }[];
  }

  const TuningForm: React.FC<TuningFormProps> = ({ modelToEdit, onSave, onBack, modelOptions }) => {
    const [displayName, setDisplayName] = useState('');
    const [baseModel, setBaseModel] = useState<Model>(Model.GEMINI_2_5_FLASH);
    const [systemInstruction, setSystemInstruction] = useState('');
    const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);
    const [sourceUrls, setSourceUrls] = useState<string[]>(['']);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    useEffect(() => {
        if (modelToEdit) {
            setDisplayName(modelToEdit.displayName);
            setBaseModel(modelToEdit.baseModel);
            setSystemInstruction(modelToEdit.systemInstruction);
            setTrainingFiles(modelToEdit.trainingFiles);
            setSourceUrls(modelToEdit.sourceUrls && modelToEdit.sourceUrls.length > 0 ? modelToEdit.sourceUrls : ['']);
        } else {
            setDisplayName('');
            setBaseModel(Model.GEMINI_2_5_FLASH);
            setSystemInstruction('');
            setTrainingFiles([]);
            setSourceUrls(['']);
        }
    }, [modelToEdit]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ displayName, baseModel, systemInstruction, trainingFiles, sourceUrls: sourceUrls.filter(url => url.trim() !== '') }, !!modelToEdit);
    };
    
    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                if (dataUrl) {
                    setTrainingFiles(prev => [...prev, { name: file.name, mimeType: file.type, dataUrl }]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };
    
    const removeFile = (index: number) => {
        setTrainingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2">
                <ArrowLeft className="h-4 w-4" /> Back to list
            </button>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{modelToEdit ? 'Edit Tuned Model' : 'Create a Tuned Model'}</h3>
            
            <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Display Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-950" />
            </div>

            <LocalDropdown label="Base Model" options={modelOptions} selectedValue={baseModel} onSelect={val => setBaseModel(val as Model)} />

            <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">System Instruction</label>
                <textarea value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} rows={3} className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-950 resize-y" />
            </div>

            <div>
                 <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Training Data</label>
                 <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-200 ${
                        isDragging
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                    }`}
                 >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                    <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="font-medium text-blue-600 hover:text-blue-500">
                            Upload files
                        </button>
                         {' '}or drag and drop
                    </p>
                 </div>
                 {trainingFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {trainingFiles.map((file, i) => (
                            <li key={i} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                                <button type="button" onClick={() => removeFile(i)} className="p-0.5 text-gray-400 hover:text-red-500">
                                    <X className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                 )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    {modelToEdit ? 'Update & Retrain' : 'Save & Train'}
                </button>
            </div>
        </form>
    );
  };


  return (
    <aside className={`
      bg-white dark:bg-gray-950 flex-shrink-0 overflow-hidden
      ${ isMobile
        ? `fixed top-14 bottom-0 right-0 z-30 w-[320px] border-l border-gray-200 dark:border-gray-700 shadow-lg transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`
        : `border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[320px] border ml-4' : 'w-0 border-none'}`
      }
    `}>
      <div className={`
        p-4 w-[320px] transition-opacity duration-150 ease-in-out overflow-y-auto h-full hover-scrollbar [scrollbar-gutter:stable]
        ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}
      `}>
          <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-lg flex mb-4">
              <TabButton tabId="tuning">Tuning</TabButton>
              <TabButton tabId="files">Files</TabButton>
          </div>
          {activeTab === 'files' ? <FilesTabContent /> : <TuningTabContent />}
      </div>
    </aside>
  );
};