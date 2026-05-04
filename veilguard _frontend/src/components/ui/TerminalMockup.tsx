"use client";

import { motion } from 'framer-motion';

export default function TerminalMockup() {
  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl overflow-hidden bg-background-code border border-border shadow-[0_24px_64px_rgba(0,0,0,0.5)] mt-16 relative z-10">
      {/* macOS titlebar */}
      <div className="h-10 bg-[#0A1218] border-b border-border flex items-center px-4 gap-2">
        <div className="w-3 h-3 rounded-full bg-[#EF4444]/80"></div>
        <div className="w-3 h-3 rounded-full bg-[#F59E0B]/80"></div>
        <div className="w-3 h-3 rounded-full bg-[#34D399]/80"></div>
        <div className="mx-auto text-[13px] font-medium text-text-muted select-none">
          veilguard-agent — node
        </div>
      </div>
      
      {/* Terminal content */}
      <div className="p-6 md:p-8 font-mono text-sm leading-[1.7] text-text-body overflow-x-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <span className="text-accent mr-2">{'>'}</span>
          <span>Create a users table with Supabase</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="mb-6"
        >
          <span className="text-status-secure mr-2">✓</span>
          <span>Created table "users" with columns: id, email, name, created_at</span>
        </motion.div>

        {/* Nudge block */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="pl-4 border-l-[3px] border-status-warning my-6 bg-status-warning/5 py-4 pr-4 rounded-r-lg"
        >
          <div className="text-status-warning text-[13px] mb-2 tracking-wide font-medium flex items-center gap-2">
            ~~ veilguard ~~ gentle nudge
          </div>
          <div className="mb-2">
            <span className="text-[#3B82F6]">│</span> Missing Row Level Security on "users" table.<br/>
            <span className="text-[#3B82F6]">│</span> Anyone with the anon key can read all rows.
          </div>
          <div>
            <span className="text-[#3B82F6]">│</span> Fix: <span className="text-[#3B82F6]">ALTER TABLE</span> users <span className="text-[#3B82F6]">ENABLE ROW LEVEL SECURITY</span>;<br/>
            <span className="text-[#3B82F6]">│</span>      <span className="text-[#3B82F6]">CREATE POLICY</span> <span className="text-[#F59E0B]">"Users see own data"</span> <span className="text-[#3B82F6]">ON</span> users<br/>
            <span className="text-[#3B82F6]">│</span>        <span className="text-[#3B82F6]">FOR SELECT USING</span> (auth.uid() = id);
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 3.0 }}
          className="mb-4"
        >
          <span className="text-accent mr-2">{'>'}</span>
          <span>fix that</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 3.8 }}
          className="mb-6"
        >
          <span className="text-status-secure mr-2">✓</span>
          <span>RLS enabled. Policy created.</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 4.5 }}
          className="text-status-secure text-[13px] tracking-wide font-medium flex items-center gap-2 mt-4"
        >
          ~~ veilguard ~~ all clear ✓
        </motion.div>
      </div>
    </div>
  );
}
