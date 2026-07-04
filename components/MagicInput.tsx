
import React, { useState, useRef } from 'react';
import { parseInputToTransaction, parseStatementToTransactions } from '../services/geminiService';
import { AIAnalysisResult } from '../types';

interface Props {
  onSuccess: (data: AIAnalysisResult) => void;
  onBulkSuccess: (data: AIAnalysisResult[]) => void;
  onLoading: (isLoading: boolean) => void;
  onManualEntry?: () => void;
}

const MagicInput: React.FC<Props> = ({ onSuccess, onBulkSuccess, onLoading, onManualEntry }) => {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleMagicSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    onLoading(true);
    const result = await parseInputToTransaction(input);
    if (result) {
      onSuccess(result);
      setInput('');
    }
    onLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onLoading(true);
    // Explicitly cast to File[] to ensure 'file' is not 'unknown' in the map callback
    const fileList = Array.from(files) as File[];
    
    // Turbo Mode: Batch Processing
    const processingPromises = fileList.map((file: File) => {
      return new Promise<AIAnalysisResult | AIAnalysisResult[] | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const resultRaw = reader.result;
          if (typeof resultRaw !== 'string') {
            resolve(null);
            return;
          }
          const base64 = resultRaw.split(',')[1];
          const fileData = { data: base64, mimeType: file.type };

          // Use 'file' properties correctly now that it's typed as File
          if (file.type === 'application/pdf' || file.name.endsWith('.csv')) {
            const results = await parseStatementToTransactions(fileData);
            resolve(results);
          } else {
            const result = await parseInputToTransaction(fileData, true);
            resolve(result);
          }
        };
        // Fix line 56: explicitly typed 'file' is now a valid Blob/File
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.all(processingPromises);
    const flattenedResults: AIAnalysisResult[] = [];
    
    results.forEach(res => {
      if (Array.isArray(res)) flattenedResults.push(...res);
      else if (res) flattenedResults.push(res);
    });

    if (flattenedResults.length > 0) {
      onBulkSuccess(flattenedResults);
    }

    onLoading(false);
    e.target.value = ''; // Reset input
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const resultRaw = reader.result;
          if (typeof resultRaw !== 'string') {
            onLoading(false);
            return;
          }
          const base64 = resultRaw.split(',')[1];
          onLoading(true);
          const result = await parseInputToTransaction({ data: base64, mimeType: 'audio/webm' }, true);
          if (result) onSuccess(result);
          onLoading(false);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="relative group">
      <form onSubmit={handleMagicSubmit} className="flex items-center gap-2 p-1.5 bg-white border-2 border-slate-200 rounded-2xl focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition shadow-sm">
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent px-3 py-2 text-slate-800 outline-none placeholder:text-slate-400 font-medium"
            placeholder="Log coffee, or upload receipts batch..."
          />
        </div>
        
        <div className="flex items-center gap-1 pr-1">
          {onManualEntry && (
            <button
              type="button"
              onClick={onManualEntry}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-indigo-50 text-indigo-500 transition"
              title="Manual Form Entry"
            >
              <i className="fas fa-edit"></i>
            </button>
          )}

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Voice Record"
          >
            <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition"
            title="Upload Multi-Receipt (Turbo Mode)"
          >
            <i className="fas fa-images"></i>
          </button>

          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:bg-slate-400 shadow-md shadow-indigo-200"
          >
            <i className="fas fa-magic"></i>
          </button>
        </div>
      </form>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,application/pdf,.csv"
        multiple
      />

      <div className="absolute -bottom-6 left-3 text-[10px] text-slate-400 flex gap-4 uppercase font-black tracking-wider">
        <span>Turbo Batch Engine Active</span>
        <i className="fas fa-bolt text-amber-400"></i>
      </div>
    </div>
  );
};

export default MagicInput;
