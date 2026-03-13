'use client';

import { FormEvent, useEffect, useState } from 'react';

import { DataTable, TableColumn } from '../../components/DataTable';
import { AuthGuard } from '../../components/AuthGuard';
import { apiRequest } from '../../lib/api';

interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  className?: string;
  sectionName?: string;
  classId?: string;
  sectionId?: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [admissionNo, setAdmissionNo] = useState('ADM-001');
  const [firstName, setFirstName] = useState('Asha');
  const [lastName, setLastName] = useState('Kumar');
  const [className, setClassName] = useState('Class 1');
  const [sectionName, setSectionName] = useState('A');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadStudents();
  }, []);

  async function loadStudents() {
    try {
      const data = await apiRequest<Student[]>('/tenant/students');
      setStudents(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load students');
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    try {
      await apiRequest('/tenant/students', {
        method: 'POST',
        body: JSON.stringify({ admissionNo, firstName, lastName, className, sectionName }),
      });
      setMessage('Student created.');
      setShowAddForm(false);
      await loadStudents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create student');
    }
  }

  function beginEdit(student: Student) {
    setEditingStudentId(student.id);
    setAdmissionNo(student.admissionNo);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setClassName(student.className ?? student.classId ?? '');
    setSectionName(student.sectionName ?? student.sectionId ?? '');
    setShowAddForm(true);
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudentId) {
      return;
    }

    setMessage('');
    try {
      await apiRequest(`/tenant/students/${editingStudentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ admissionNo, firstName, lastName, className, sectionName }),
      });
      setMessage('Student updated.');
      setEditingStudentId(null);
      setShowAddForm(false);
      await loadStudents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update student');
    }
  }

  async function deactivateStudent(studentId: string) {
    setMessage('');
    try {
      await apiRequest(`/tenant/students/${studentId}/deactivate`, {
        method: 'PATCH',
      });
      setMessage('Student deactivated.');
      await loadStudents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to deactivate student');
    }
  }

  // DataTable columns
  const columns: TableColumn<Student>[] = [
    { key: 'admissionNo', label: 'Admission Number' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'className', label: 'Class', render: (row) => row.className ?? row.classId ?? '-' },
    { key: 'sectionName', label: 'Section', render: (row) => row.sectionName ?? row.sectionId ?? '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            onClick={() => beginEdit(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
            onClick={() => void deactivateStudent(row.id)}
          >
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  return (
    <AuthGuard>
      {() => (
        <main className="mx-auto max-w-5xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Students</h1>
            <button
              type="button"
              className="rounded bg-slate-900 px-4 py-2 text-white"
              onClick={() => {
                setEditingStudentId(null);
                setShowAddForm((value) => !value);
              }}
            >
              Add Student
            </button>
          </div>

          {showAddForm ? (
            <form className="mb-4 grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-6" onSubmit={editingStudentId ? onSaveEdit : onCreate}>
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={admissionNo}
                onChange={(event) => setAdmissionNo(event.target.value)}
                placeholder="Admission Number"
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First Name"
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last Name"
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="Class"
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={sectionName}
                onChange={(event) => setSectionName(event.target.value)}
                placeholder="Section"
              />
              <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">
                {editingStudentId ? 'Save Student' : 'Create Student'}
              </button>
            </form>
          ) : null}

          <button className="mb-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm" onClick={loadStudents}>
            Refresh
          </button>

          {message ? <p className="mb-3 text-sm text-slate-700">{message}</p> : null}

          <DataTable
            columns={columns}
            data={students.map((s) => ({ ...s, actions: '', id: s.id }))}
            loading={false}
            filters={null}
            page={1}
            pageSize={students.length || 10}
            total={students.length}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </main>
      )}
    </AuthGuard>
  );
}
