import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, RefreshCw, Trophy, Utensils, Users, Shuffle, MapPin, BarChart3, RotateCcw, CheckCircle2, LogIn, Share2, Copy, AlertCircle, Loader2 } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, onSnapshot, updateDoc, setDoc, 
  arrayUnion, arrayRemove, collection, deleteField 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';

// --- 🔥 配置区域 🔥 ---
const firebaseConfig = {
  apiKey: "AIzaSyDQZwutALwof2LdU-imM1kJSBzAhsJ52-4",
  authDomain: "chishenme-584f6.firebaseapp.com",
  projectId: "chishenme-584f6",
  storageBucket: "chishenme-584f6.firebasestorage.app",
  messagingSenderId: "105612040568",
  appId: "1:105612040568:web:fea6b0045fb8db5644908d"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Main Component ---
const App = () => {
  // 用户状态
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false); // 新增：加入房间的加载状态

  // 房间数据
  const [roomData, setRoomData] = useState({
    options: [
      "老火锅", "砂锅串串", "万州烤鱼", "重庆鸡公煲", 
      "韩式自助烤肉", "美蛙鱼头", "黔江鸡杂", "纸包鱼", 
      "把把烧/深夜烧烤", "干锅/香锅", "江湖菜", "酸萝卜老鸭汤"
    ],
    votes: {}, 
    status: 'voting', 
    finalWinner: null
  });

  const [newOption, setNewOption] = useState('');
  const [currentDisplay, setCurrentDisplay] = useState('等待开始');
  const [isSpinning, setIsSpinning] = useState(false);
  const timerRef = useRef(null);

  // 1. 初始化 Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("登录失败", error);
            setAuthError("无法连接服务器，请检查网络或 Firebase 配置。");
        }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if(u) setAuthError(null);
    });
    return () => unsubscribe();
  }, []);

  // 2. 监听房间数据
  useEffect(() => {
    if (!user || !roomId) return;

    const roomRef = doc(db, 'rooms', roomId);
    
    // 监听数据变化
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(prev => ({
          ...prev,
          ...data,
          // 防止 options 被清空导致报错
          options: data.options && data.options.length > 0 ? data.options : prev.options
        }));
        
        if (data.status === 'revealed' && data.finalWinner) {
          setCurrentDisplay(data.finalWinner);
        }
      }
    }, (error) => {
      console.error("同步失败:", error);
      alert("数据同步断开，请尝试刷新页面。\n错误: " + error.message);
    });

    return () => unsubscribe();
  }, [user, roomId]);

  // --- 业务逻辑 ---

  const handleJoinRoom = async () => {
    const targetRoomId = inputRoomId.trim().toUpperCase();
    if (!targetRoomId) {
      alert("请输入房间号");
      return;
    }
    
    if (!user) {
      alert("正在连接服务器，请稍后...");
      return;
    }

    setIsJoining(true); // 开始转圈圈

    const roomRef = doc(db, 'rooms', targetRoomId);
    try {
      // 尝试写入，如果权限不够(Rule没开)这里会报错
      await setDoc(roomRef, {
        lastActive: new Date().toISOString()
      }, { merge: true });
      
      setRoomId(targetRoomId);
      setJoined(true);
    } catch (err) {
      console.error("加入房间失败:", err);
      if (err.code === 'permission-denied') {
        alert("加入失败：权限不足。\n请去 Firebase 后台 -> Firestore Database -> Rules \n将 allow read, write 改为 if true");
      } else {
        alert("加入失败，请检查网络。\n" + err.message);
      }
    } finally {
      setIsJoining(false); // 结束转圈圈
    }
  };

  const handleCreateRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    setInputRoomId(randomId);
  };

  // ... (其他逻辑保持不变)
  const startSpin = () => {
    if (isSpinning || roomData.status === 'revealed') return;
    if (roomData.options.length < 2) return;
    setIsSpinning(true);
    let speed = 50;
    let counter = 0;
    const totalSpins = 20 + Math.floor(Math.random() * 15);
    const spin = () => {
      const randomIndex = Math.floor(Math.random() * roomData.options.length);
      setCurrentDisplay(roomData.options[randomIndex]);
      counter++;
      if (counter < totalSpins) {
        if (counter > totalSpins - 10) speed += 30;
        else if (counter > totalSpins - 5) speed += 60;
        timerRef.current = setTimeout(spin, speed);
      } else {
        const finalIndex = Math.floor(Math.random() * roomData.options.length);
        const result = roomData.options[finalIndex];
        setCurrentDisplay(result);
        submitVote(result);
        setIsSpinning(false);
      }
    };
    spin();
  };

  const submitVote = async (voteResult) => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      [`votes.${user.uid}`]: voteResult
    });
  };

  const handleRevealResult = async () => {
    if (!user || !roomId) return;
    const counts = {};
    const currentVotes = Object.values(roomData.votes || {});
    if (currentVotes.length === 0) return;
    currentVotes.forEach(v => counts[v] = (counts[v] || 0) + 1);
    let maxCount = 0;
    Object.values(counts).forEach(c => { if (c > maxCount) maxCount = c; });
    const candidates = Object.keys(counts).filter(k => counts[k] === maxCount);
    const final = candidates[Math.floor(Math.random() * candidates.length)];
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      status: 'revealed',
      finalWinner: final
    });
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (newOption.trim() && !roomData.options.includes(newOption.trim())) {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        options: arrayUnion(newOption.trim())
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = async (itemToRemove) => {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      options: arrayRemove(itemToRemove)
    });
  };

  const handleReset = async () => {
    if (!confirm("确定要重置房间吗？所有人的投票将被清空。")) return;
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      votes: {},
      status: 'voting',
      finalWinner: null
    });
    setCurrentDisplay('准备投票');
  };

  const myVote = user && roomData.votes ? roomData.votes[user.uid] : null;
  const totalVotes = roomData.votes ? Object.keys(roomData.votes).length : 0;
  
  const getVoteStats = () => {
    const counts = {};
    const votes = Object.values(roomData.votes || {});
    votes.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert("房间号已复制！发给朋友们吧");
  };

  // --- 登录/加入界面 ---
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-4 border-red-100">
          <div className="text-center mb-8">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <Utensils size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800">重庆聚餐投票器</h1>
            <div className="flex justify-center items-center gap-2 mt-2">
              {user ? (
                <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10}/> 服务器已连接
                </span>
              ) : (
                <span className="text-orange-500 text-xs font-bold bg-orange-100 px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                  <Loader2 size={10} className="animate-spin"/> 连接中...
                </span>
              )}
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">房间号</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  placeholder="例如: ABCD"
                  className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-mono font-bold text-center tracking-widest focus:border-red-500 focus:outline-none uppercase"
                />
              </div>
            </div>

            <button 
              onClick={handleJoinRoom}
              disabled={!inputRoomId || isJoining || !user}
              className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> 正在进入...
                </>
              ) : (
                "加入房间"
              )}
            </button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">或者</span></div>
            </div>

            <button 
              onClick={handleCreateRoom}
              className="w-full bg-white border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all"
            >
              创建新房间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 主界面 ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-2" onClick={copyRoomId}>
           <div className="bg-slate-100 px-3 py-1 rounded-lg flex items-center gap-2 cursor-pointer active:bg-slate-200">
             <span className="text-xs text-slate-400 font-bold">房间</span>
             <span className="font-mono font-bold text-red-600 text-lg tracking-wider">{roomId}</span>
             <Copy size={14} className="text-slate-400"/>
           </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users size={16} className="text-red-500"/>
          <span className="font-bold">{totalVotes}</span> 人已投
        </div>
      </div>

      <main className="max-w-md mx-auto p-4 flex flex-col gap-6">
        
        <div className="relative mt-2">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1 rounded-full z-10 shadow-md">
             {roomData.status === 'revealed' ? '🎉 最终结果出炉' : (myVote ? '✅ 你已完成投票' : '👇 请点击投票')}
          </div>

          <div className={`
            aspect-video rounded-3xl flex flex-col items-center justify-center p-4 text-center shadow-lg border-4 relative overflow-hidden bg-white
            ${roomData.status === 'revealed' ? 'border-yellow-400 ring-4 ring-yellow-100' : 'border-red-100'}
          `}>
            
            <h2 className={`font-black text-3xl break-words w-full transition-all duration-100 
              ${isSpinning ? 'opacity-50 blur-[1px]' : 'opacity-100'}
              ${roomData.status === 'revealed' ? 'text-red-600 scale-110' : 'text-slate-700'}
            `}>
              {roomData.status === 'revealed' ? roomData.finalWinner : currentDisplay}
            </h2>
            
            {myVote && roomData.status !== 'revealed' && !isSpinning && (
              <div className="mt-4 text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-1.5 rounded-full flex items-center gap-1 animate-in slide-in-from-bottom-2">
                <CheckCircle2 size={14}/> 你的选择: {myVote}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-6">
            {roomData.status !== 'revealed' && (
              <button
                onClick={startSpin}
                disabled={isSpinning || myVote}
                className={`
                  flex-1 py-4 rounded-2xl text-lg font-bold shadow-lg transition-all transform active:scale-95
                  flex items-center justify-center gap-2
                  ${(isSpinning || myVote)
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                    : 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-red-300 hover:-translate-y-1'
                  }
                `}
              >
                {isSpinning ? <RefreshCw className="animate-spin" /> : <Shuffle />}
                {myVote ? "坐等开奖..." : "随机选一个"}
              </button>
            )}
          </div>
          
          {totalVotes > 0 && roomData.status !== 'revealed' && (
             <button
              onClick={handleRevealResult}
              className="w-full mt-3 py-3 rounded-2xl text-md font-bold bg-slate-800 text-white shadow-lg hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Trophy size={18} className="text-yellow-400"/> 
              {totalVotes >= 2 ? `大家都投完了，开奖！` : `直接开奖 (${totalVotes}票)`}
            </button>
          )}

          {roomData.status === 'revealed' && (
             <button
              onClick={handleReset}
              className="w-full mt-3 py-3 rounded-2xl text-md font-bold bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={18}/> 再来一局
            </button>
          )}
        </div>

        {totalVotes > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                <BarChart3 size={16} className="text-red-500"/> 
                实时票数 ({totalVotes})
              </h3>
            </div>
            <div className="space-y-3">
              {getVoteStats().map(([name, count], index) => (
                <div key={name} className="relative">
                  <div className="absolute inset-0 bg-slate-50 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-red-50 transition-all duration-500 ease-out"
                      style={{ width: `${(count / totalVotes) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="relative p-2 flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-slate-400'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 text-slate-700 text-sm font-bold truncate">{name}</div>
                    <div className="text-xs font-mono font-bold text-red-500 bg-white/50 px-2 py-0.5 rounded-md">
                      {count}票
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700 text-sm">菜单选项 (同步)</h3>
          </div>

          <form onSubmit={handleAddOption} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="加个选项..."
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white text-sm"
            />
            <button 
              type="submit"
              disabled={!newOption.trim()}
              className="bg-red-100 text-red-600 p-2 rounded-xl hover:bg-red-200 disabled:opacity-50"
            >
              <Plus size={18}/>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {roomData.options && roomData.options.map((option, index) => (
              <div 
                key={index + option}
                className="group bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs border border-slate-200 flex items-center gap-2"
              >
                <span>{option}</span>
                <button 
                  onClick={() => handleRemoveOption(option)}
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;