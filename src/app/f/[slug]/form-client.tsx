'use client';

import React from 'react';
import FormPlayer from '@/components/forms/form-player';
import type { Form } from '@/types/form';

interface FormClientProps {
  form: Form;
}

export default function FormClient({ form }: FormClientProps) {
  return <FormPlayer form={form} />;
}
