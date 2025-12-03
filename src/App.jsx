import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';

export default function WitsShellTerminal() {
  const [history, setHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [paths, setPaths] = useState(['/bin']);
  const [currentDirectory, setCurrentDirectory] = useState('/home/user');
  const [fileSystem, setFileSystem] = useState({
    '/home/user': { type: 'dir', contents: {} },
    '/bin': { type: 'dir', contents: {} }
  });
  const [environmentVars, setEnvironmentVars] = useState({
    HOME: '/home/user',
    USER: 'user',
    PATH: '/bin'
  });
  
  const inputRef = useRef(null);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const addToHistory = (command, output, isError = false) => {
    setHistory(prev => [...prev, { command, output, isError, timestamp: Date.now() }]);
  };

  const findExecutable = (command) => {
    const builtinCommands = ['cd', 'path', 'exit', 'ls', 'pwd', 'echo', 'env', 'mkdir', 'touch', 'cat', 'clear'];
    if (builtinCommands.includes(command)) return command;
    
    for (let path of paths) {
      const fullPath = `${path}/${command}`;
      if (fileSystem[fullPath]) return fullPath;
    }
    return null;
  };

  const handleCd = (args) => {
    if (args.length === 0) {
      return { output: 'An error has occurred', isError: true };
    }
    
    let targetDir = args[0];
    
    if (targetDir === '~') {
      targetDir = environmentVars.HOME;
    } else if (targetDir.startsWith('~/')) {
      targetDir = environmentVars.HOME + targetDir.slice(1);
    } else if (!targetDir.startsWith('/')) {
      targetDir = `${currentDirectory}/${targetDir}`;
    }
    
    targetDir = targetDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    if (fileSystem[targetDir] && fileSystem[targetDir].type === 'dir') {
      setCurrentDirectory(targetDir);
      return { output: '', isError: false };
    }
    
    return { output: 'An error has occurred', isError: true };
  };

  const handlePath = (args) => {
    if (args.length === 0) {
      setPaths([]);
      setEnvironmentVars(prev => ({ ...prev, PATH: '' }));
    } else {
      setPaths(args);
      setEnvironmentVars(prev => ({ ...prev, PATH: args.join(':') }));
    }
    return { output: '', isError: false };
  };

  const handleLs = () => {
    const currentDirContents = fileSystem[currentDirectory]?.contents || {};
    const items = Object.keys(currentDirContents);
    
    if (items.length === 0) {
      return { output: '', isError: false };
    }
    
    return { 
      output: items.map(item => {
        const isDir = currentDirContents[item].type === 'dir';
        return isDir ? `${item}/` : item;
      }).join('  '), 
      isError: false 
    };
  };

  const handlePwd = () => {
    return { output: currentDirectory, isError: false };
  };

  const handleEcho = (args) => {
    const processedArgs = args.map(arg => {
      if (arg.startsWith('$')) {
        const varName = arg.slice(1);
        return environmentVars[varName] || '';
      }
      return arg;
    });
    return { output: processedArgs.join(' '), isError: false };
  };

  const handleEnv = () => {
    const envOutput = Object.entries(environmentVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    return { output: envOutput, isError: false };
  };

  const handleMkdir = (args) => {
    if (args.length === 0) {
      return { output: 'An error has occurred', isError: true };
    }
    
    const dirName = args[0];
    const newDirPath = dirName.startsWith('/') 
      ? dirName 
      : `${currentDirectory}/${dirName}`.replace(/\/+/g, '/');
    
    if (fileSystem[newDirPath]) {
      return { output: 'An error has occurred', isError: true };
    }
    
    const parentPath = newDirPath.split('/').slice(0, -1).join('/') || '/';
    if (!fileSystem[parentPath]) {
      return { output: 'An error has occurred', isError: true };
    }
    
    setFileSystem(prev => {
      const newFS = { ...prev };
      newFS[newDirPath] = { type: 'dir', contents: {} };
      const parent = { ...newFS[parentPath] };
      parent.contents = { ...parent.contents, [dirName]: { type: 'dir' } };
      newFS[parentPath] = parent;
      return newFS;
    });
    
    return { output: '', isError: false };
  };

  const handleTouch = (args) => {
    if (args.length === 0) {
      return { output: 'An error has occurred', isError: true };
    }
    
    const fileName = args[0];
    const newFilePath = fileName.startsWith('/') 
      ? fileName 
      : `${currentDirectory}/${fileName}`.replace(/\/+/g, '/');
    
    setFileSystem(prev => {
      const newFS = { ...prev };
      newFS[newFilePath] = { type: 'file', content: '' };
      const dirName = fileName.split('/').pop();
      const parent = { ...newFS[currentDirectory] };
      parent.contents = { ...parent.contents, [dirName]: { type: 'file' } };
      newFS[currentDirectory] = parent;
      return newFS;
    });
    
    return { output: '', isError: false };
  };

  const handleCat = (args) => {
    if (args.length === 0) {
      return { output: 'An error has occurred', isError: true };
    }
    
    const fileName = args[0];
    const filePath = fileName.startsWith('/') 
      ? fileName 
      : `${currentDirectory}/${fileName}`.replace(/\/+/g, '/');
    
    const file = fileSystem[filePath];
    if (!file || file.type !== 'file') {
      return { output: 'An error has occurred', isError: true };
    }
    
    return { output: file.content || '', isError: false };
  };

  const handleClear = () => {
    setHistory([]);
    return { output: '', isError: false, skipHistory: true };
  };

  const parseCommand = (commandString) => {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < commandString.length; i++) {
      const char = commandString[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ' ' || char === '\t') && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) tokens.push(current);
    
    return tokens.map(token => {
      if (token.startsWith('$')) {
        const varName = token.slice(1);
        return environmentVars[varName] || '';
      }
      return token;
    });
  };

  const executeCommand = (commandString) => {
    const trimmed = commandString.trim();
    
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const commands = trimmed.split('&').map(cmd => cmd.trim()).filter(cmd => cmd);
    
    commands.forEach(cmd => {
      const tokens = parseCommand(cmd);
      const command = tokens[0];
      const args = tokens.slice(1);

      let result;

      switch (command) {
        case 'exit':
          if (args.length > 0) {
            result = { output: 'An error has occurred', isError: true };
          } else {
            result = { output: 'Goodbye! (exit not available in web terminal)', isError: false };
          }
          break;
        
        case 'cd':
          result = handleCd(args);
          break;
        
        case 'path':
          result = handlePath(args);
          break;
        
        case 'ls':
          result = handleLs();
          break;
        
        case 'pwd':
          result = handlePwd();
          break;
        
        case 'echo':
          result = handleEcho(args);
          break;
        
        case 'env':
          result = handleEnv();
          break;
        
        case 'mkdir':
          result = handleMkdir(args);
          break;
        
        case 'touch':
          result = handleTouch(args);
          break;
        
        case 'cat':
          result = handleCat(args);
          break;
        
        case 'clear':
          result = handleClear();
          break;
        
        default:
          { const executable = findExecutable(command);
          if (!executable) {
            result = { output: 'An error has occurred', isError: true };
          } else {
            result = { output: `Executed: ${command} ${args.join(' ')}`, isError: false };
          } }
      }

      if (!result.skipHistory) {
        addToHistory(cmd, result.output, result.isError);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(currentInput);
      setCurrentInput('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 font-mono p-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gray-700 px-4 py-2 flex items-center gap-2 border-b border-gray-600">
            <Terminal size={18} />
            <span className="font-semibold">WitsShell Terminal</span>
            <span className="ml-auto text-xs text-gray-400">React Implementation</span>
          </div>
          
          <div className="p-4 h-96 overflow-y-auto">
            {history.map((entry, idx) => (
              <div key={idx} className="mb-2">
                <div className="flex gap-2">
                  <span className="text-blue-400">witsshell&gt;</span>
                  <span className="text-gray-300">{entry.command}</span>
                </div>
                {entry.output && (
                  <div className={entry.isError ? 'text-red-400' : 'text-green-400'}>
                    {entry.output}
                  </div>
                )}
              </div>
            ))}
            
            <div className="flex gap-2">
              <span className="text-blue-400">witsshell&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-gray-300"
                autoFocus
              />
            </div>
            <div ref={terminalEndRef} />
          </div>
          
          <div className="bg-gray-700 px-4 py-2 text-xs text-gray-400 border-t border-gray-600">
            Current Directory: {currentDirectory} | Paths: {paths.join(', ') || 'none'}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          <p className="mb-2">Available commands: cd, path, ls, pwd, echo, env, mkdir, touch, cat, clear, exit</p>
          <p>Features: Environment variables ($VAR), quoted strings, parallel commands (&amp;), directory navigation</p>
        </div>
      </div>
    </div>
  );
}