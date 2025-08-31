import React, { useState, useEffect, useRef } from 'react';
import { Plus, Settings, Trash2, MoreVertical, Edit } from 'lucide-react';
import { ChatSession } from '../types';

interface NavigationSidebarProps {
  isSidebarOpen: boolean;
  onNewChat: () => void;
  chatHistory: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  isMobile: boolean;
  onOpenSettings: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ isSidebarOpen, onNewChat, chatHistory, activeChatId, onSelectChat, onDeleteChat, onRenameChat, isMobile, onOpenSettings }) => {
  const isActuallyOpen = isMobile ? true : isSidebarOpen;
  
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [bottomSheetChat, setBottomSheetChat] = useState<ChatSession | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleTouchStart = (chat: ChatSession) => {
    isLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
        isLongPress.current = true;
        setBottomSheetChat(chat);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
      }
  };
  
  const handleClick = (chat: ChatSession) => {
      if (isMobile && isLongPress.current) {
          return; // Prevent navigation on long press
      }
      if (renamingId !== chat.id) {
          onSelectChat(chat.id);
      }
  };

  const handleRenameStart = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
    setMenuId(null);
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      onRenameChat(renamingId, renameValue);
    }
    setRenamingId(null);
  };
  
  const handleMobileRenameStart = (id: string, currentTitle: string) => {
      setBottomSheetChat(null);
      // Delay allows sheet to close before input appears
      setTimeout(() => handleRenameStart(id, currentTitle), 100);
  };
  
  const handleMobileDelete = (id: string) => {
      setBottomSheetChat(null);
      onDeleteChat(id);
  };
  
  return (
    <>
        <aside
          className={`
            bg-white dark:bg-gray-950 flex flex-col p-4
            transition-all duration-300 ease-in-out flex-shrink-0
            ${ isMobile
                ? `fixed top-14 bottom-0 left-0 z-30 w-[260px] shadow-lg ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
                : `${isSidebarOpen ? 'w-[260px]' : 'w-20'}`
            }
          `}
        >
          <div className={`flex items-center gap-2 mb-6 px-1 flex-shrink-0 ${isMobile ? 'hidden' : ''}`}>
              <img src="/logo.svg" alt="REXPro AI Logo" className="w-8 h-8 flex-shrink-0" />
              <h1 className={`text-lg font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap transition-opacity duration-200 ${isActuallyOpen ? 'opacity-100' : 'opacity-0'}`}>REXPro AI</h1>
          </div>
          <button
            onClick={onNewChat}
            data-tooltip-text="New Chat"
            data-tooltip-position={isActuallyOpen ? "bottom" : "right"}
            className="flex items-center w-[85%] px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className={`ml-2 whitespace-nowrap overflow-hidden transition-all duration-200 ${isActuallyOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>New Chat</span>
          </button>

          <div className={`mt-6 flex-1 overflow-y-auto overflow-x-hidden transition-opacity duration-200 hover-scrollbar [scrollbar-gutter:stable] ${isActuallyOpen ? 'opacity-100' : 'opacity-0'}`}>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">RECENT</h2>
            <nav className="space-y-1">
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleClick(chat)}
                  onTouchStart={isMobile ? () => handleTouchStart(chat) : undefined}
                  onTouchEnd={isMobile ? handleTouchEnd : undefined}
                  onTouchMove={isMobile ? handleTouchMove : undefined}
                  className={`group flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${chat.id === activeChatId ? 'bg-gray-100 dark:bg-gray-800/80 font-semibold' : ''}`}
                >
                  {renamingId === chat.id ? (
                    <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full bg-transparent border-b border-blue-500 focus:outline-none text-sm"
                    />
                  ) : (
                    <span className="truncate flex-1">{chat.title}</span>
                  )}
                  
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === chat.id ? null : chat.id);
                      }}
                      data-tooltip-text="Options"
                      data-tooltip-position="left"
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full transition-opacity hidden md:flex"
                      aria-label={`Options for chat: ${chat.title}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                     {!isMobile && menuId === chat.id && (
                      <div ref={menuRef} className="absolute right-[-0.8rem] top-[2.5rem] w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRenameStart(chat.id, chat.title); }}
                          className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        >
                          <Edit className="w-3.5 h-3.5" /> Rename
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); setMenuId(null); }}
                          className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className={`mt-auto flex-shrink-0 whitespace-nowrap transition-opacity duration-200 ${isActuallyOpen ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={onOpenSettings}
              data-tooltip-text="Settings"
              data-tooltip-position={isActuallyOpen ? "top" : "right"}
              className="flex items-center w-[85%] px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0 mb-6"
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className={`ml-2 whitespace-nowrap overflow-hidden transition-all duration-200 ${isActuallyOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>Settings</span>
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 pl-1">Signed in as <span className="font-bold text-gray-800 dark:text-gray-100">omniverse1</span></p>
          </div>
        </aside>
        
        {isMobile && bottomSheetChat && (
            <>
                <div 
                    className="fixed inset-0 bg-black/50 z-40 animate-fade-in" 
                    onClick={() => setBottomSheetChat(null)}
                />
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl z-50 p-4 pb-6 shadow-lg animate-slide-up">
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4"></div>
                    <div className="mb-4 px-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Options for:</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{bottomSheetChat.title}</p>
                    </div>
                    <div className="space-y-2">
                        <button
                            onClick={() => handleMobileRenameStart(bottomSheetChat.id, bottomSheetChat.title)}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <Edit className="w-5 h-5" /> Rename
                        </button>
                        <button
                            onClick={() => handleMobileDelete(bottomSheetChat.id)}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 text-base text-red-600 dark:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-5 h-5" /> Delete
                        </button>
                    </div>
                </div>
            </>
        )}
    </>
  );
};