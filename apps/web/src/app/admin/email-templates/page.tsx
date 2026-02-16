'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EmailEditor } from '@/components/email-editor';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

interface Variable {
  key: string;
  description: string;
}

type View = 'list' | 'create' | 'edit';

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [view, setView] = useState<View>('list');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [htmlBody, setHtmlBody] = useState('');

  // Preview/Send dialogs
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [sendTestEmail, setSendTestEmail] = useState('');
  const [sendTestStatus, setSendTestStatus] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const load = () => {
    api('/email-templates').then(setTemplates).catch(() => {});
    api('/email-templates/variables/list').then(setVariables).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName('');
    setSubject('');
    setDescription('');
    setHtmlBody('');
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetForm();
    setView('create');
  };

  const openEdit = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setSubject(tpl.subject);
    setDescription(tpl.description);
    setHtmlBody(tpl.htmlBody);
    setView('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (view === 'create') {
        await api('/email-templates', {
          method: 'POST',
          body: JSON.stringify({ name, subject, htmlBody, description }),
        });
      } else if (editingTemplate) {
        await api(`/email-templates/${editingTemplate.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, subject, htmlBody, description }),
        });
      }
      setView('list');
      resetForm();
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  };

  const handleDelete = async (tpl: EmailTemplate) => {
    if (!window.confirm(`Are you sure you want to delete template "${tpl.name}"?`)) return;
    await api(`/email-templates/${tpl.id}`, { method: 'DELETE' });
    load();
  };

  const handleToggleActive = async (tpl: EmailTemplate) => {
    await api(`/email-templates/${tpl.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    load();
  };

  const handlePreview = async () => {
    if (!editingTemplate && view !== 'edit') return;
    // For preview, we need to save first if creating, or use current editing id
    const id = editingTemplate?.id;
    if (!id) {
      alert('Please save the template first before previewing.');
      return;
    }
    try {
      const data = await api(`/email-templates/${id}/preview`, { method: 'POST', body: JSON.stringify({}) });
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to preview');
    }
  };

  const handleSendTest = async () => {
    if (!editingTemplate) return;
    if (!sendTestEmail) return;
    setSendingTest(true);
    setSendTestStatus(null);
    try {
      const result = await api(`/email-templates/${editingTemplate.id}/send-test`, {
        method: 'POST',
        body: JSON.stringify({ to: sendTestEmail }),
      });
      setSendTestStatus(result.success ? `Sent to ${sendTestEmail}` : result.message);
    } catch (err: any) {
      setSendTestStatus(err.message || 'Failed to send');
    } finally {
      setSendingTest(false);
    }
  };

  // List view
  if (view === 'list') {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Email Templates
          </h1>
          <Button
            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
            onClick={openCreate}
          >
            Create Template
          </Button>
        </div>

        <DataTable
          searchable
          searchKeys={['name', 'subject']}
          searchPlaceholder="Search templates..."
          columns={[
            {
              key: 'name',
              header: 'Name',
              sortable: true,
              render: (t) => (
                <span className="font-heading font-semibold text-sm">{t.name}</span>
              ),
            },
            {
              key: 'subject',
              header: 'Subject',
              sortable: true,
              render: (t) => (
                <span className="text-sm text-muted-foreground">{t.subject}</span>
              ),
            },
            {
              key: 'isActive',
              header: 'Status',
              sortable: true,
              render: (t) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(t);
                  }}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    t.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20'
                  }`}
                >
                  {t.isActive ? 'Active' : 'Inactive'}
                </button>
              ),
            },
            {
              key: 'createdAt',
              header: 'Created',
              sortable: true,
              hideOnMobile: true,
              sortValue: (t) => new Date(t.createdAt).getTime(),
              render: (t) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (t) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => openEdit(t)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                    onClick={() => handleDelete(t)}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
          data={templates}
        />
      </div>
    );
  }

  // Create / Edit view
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          {view === 'create' ? 'Create Template' : 'Edit Template'}
        </h1>
        <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>
          Back to List
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Template Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome Email"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Subject Line
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Welcome to {{site_name}}"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when this template is used"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Email Body
          </label>
          <EmailEditor content={htmlBody} onChange={setHtmlBody} variables={variables} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
          >
            {view === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>

          {view === 'edit' && editingTemplate && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
              >
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setSendTestOpen(true); setSendTestStatus(null); }}
              >
                Send Test
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => { setView('list'); resetForm(); }}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              {previewData?.subject && (
                <span className="block mt-1 font-medium text-foreground">
                  Subject: {previewData.subject}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div
              className="mt-2 rounded-lg border border-border/40 bg-white p-6 text-black"
              dangerouslySetInnerHTML={{ __html: previewData.html }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send Test Dialog */}
      <Dialog open={sendTestOpen} onOpenChange={setSendTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test version of this template to an email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={sendTestEmail}
              onChange={(e) => setSendTestEmail(e.target.value)}
            />
            {sendTestStatus && (
              <p className={`text-sm ${sendTestStatus.startsWith('Sent') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {sendTestStatus}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendTestOpen(false)}>
                Close
              </Button>
              <Button
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
                onClick={handleSendTest}
                disabled={sendingTest || !sendTestEmail}
              >
                {sendingTest ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
