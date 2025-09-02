import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, User, Key, Database, Info, Trash2, Download, ChevronDown } from 'lucide-react';
import { LiveConversationModel } from '../types';

type Theme = 'light' | 'dark' | 'system';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onExportHistory: () => void;
  onClearHistory: () => void;
  liveConversationModel: LiveConversationModel;
  setLiveConversationModel: (model: LiveConversationModel) => void;
}

const CustomDropdown: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}> = ({ label, options, selectedValue, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(opt => opt.value === selectedValue)?.label || selectedValue;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-left text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto hover-scrollbar" role="listbox">
          {options.map(option => (
            <div
              key={option.value}
              onClick={() => { onSelect(option.value); setIsOpen(false); }}
              className="px-3 py-2 text-sm text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer truncate"
              role="option"
              aria-selected={option.value === selectedValue}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, setTheme, onExportHistory, onClearHistory, liveConversationModel, setLiveConversationModel }) => {
  const [activeTab, setActiveTab] = useState('general');

  if (!isOpen) return null;

  const NavItem = ({ id, label, Icon }: { id: string; label: string; Icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        activeTab === id
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      }`}
    >
      <Icon className="h-4 w-4 mr-3" />
      <span>{label}</span>
    </button>
  );

  const ThemeButton = ({ value, label, Icon }: { value: Theme; label: string; Icon: React.ElementType }) => (
    <button
      onClick={() => setTheme(value)}
      className={`flex-1 p-2 rounded-lg border-2 transition-colors ${
        theme === value
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex flex-col items-center">
        <Icon className="h-6 w-6 mb-1 text-gray-700 dark:text-gray-300" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
      </div>
    </button>
  );
  
  const liveConversationModelOptions = [
    { value: LiveConversationModel.GEMINI_LIVE_2_5_FLASH_PREVIEW, label: 'Gemini Live 2.5 Flash Preview' },
    { value: LiveConversationModel.GEMINI_2_5_FLASH_NATIVE_AUDIO, label: 'Gemini 2.5 Flash (Native Audio)' },
    { value: LiveConversationModel.GEMINI_2_5_FLASH_EXP_NATIVE_AUDIO_THINKING, label: 'Gemini 2.5 Flash Exp (Native Audio, Thinking)' },
    { value: LiveConversationModel.GEMINI_2_0_FLASH_LIVE_001, label: 'Gemini 2.0 Flash Live' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[600px] flex overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Navigation */}
        <div className="w-1/4 bg-gray-50 dark:bg-gray-800/50 p-4 border-r border-gray-200 dark:border-gray-700">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 px-1">
            Settings
          </h2>
          <nav className="space-y-2">
            <NavItem id="general" label="General" Icon={Sun} />
            <NavItem id="account" label="Account & API" Icon={User} />
            <NavItem id="data" label="Data & Privacy" Icon={Database} />
            <NavItem id="about" label="About" Icon={Info} />
          </nav>
        </div>

        {/* Right Content */}
        <div className="w-3/4 flex flex-col">
          <div className="p-8 overflow-y-auto flex-1">
            {activeTab === 'general' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">General</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Theme</label>
                    <div className="flex gap-4">
                      <ThemeButton value="light" label="Light" Icon={Sun} />
                      <ThemeButton value="dark" label="Dark" Icon={Moon} />
                      <ThemeButton value="system" label="System" Icon={Monitor} />
                    </div>
                  </div>
                   <CustomDropdown
                      label="Voice Model"
                      options={liveConversationModelOptions}
                      selectedValue={liveConversationModel}
                      onSelect={(val) => setLiveConversationModel(val as LiveConversationModel)}
                    />
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Account & API</h3>
                <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="font-medium text-gray-600 dark:text-gray-300">Signed in as</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">omniverse1</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="font-medium text-gray-600 dark:text-gray-300">API Key Status</span>
                        <div className="flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-xs">
                           <Key className="h-3 w-3" />
                           <span>Loaded from Environment</span>
                        </div>
                    </div>
                </div>
              </div>
            )}
            {activeTab === 'data' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Data & Privacy</h3>
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Export Chat History</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">Download all your conversations as a JSON file.</p>
                    <button onClick={onExportHistory} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                  </div>
                   <div className="p-4 border border-red-300 dark:border-red-700/60 rounded-lg bg-red-50/50 dark:bg-red-900/20">
                    <h4 className="font-semibold text-red-800 dark:text-red-200">Clear Chat History</h4>
                    <p className="text-sm text-red-600 dark:text-red-300/80 mt-1 mb-3">Permanently delete all of your chat history. This action cannot be undone.</p>
                    <button onClick={onClearHistory} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Clear All Data
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'about' && (
               <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">About</h3>
                <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="font-medium text-gray-600 dark:text-gray-300">App Version</span>
                        <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
                    </div>
                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="font-medium text-gray-600 dark:text-gray-300 block mb-2">Helpful Links</span>
                        <ul className="space-y-1">
                            <li><a href="https://ai.google.dev/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Gemini API Documentation</a></li>
                            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</a></li>
                            <li><a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Terms of Service</a></li>
                        </ul>
                    </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};