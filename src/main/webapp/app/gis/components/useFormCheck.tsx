import React, { useCallback, useEffect, useRef, useState } from 'react';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Visible name of a field: its <label>, then aria-label, then an explicit data-field-label, then the placeholder. */
function fieldName(control: Control): string {
  const explicit = control.getAttribute('data-field-label');
  if (explicit) return explicit;
  const label = control.labels?.[0]?.textContent ?? control.getAttribute('aria-label') ?? '';
  const name = label.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  return name || (control as HTMLInputElement).placeholder || control.name || 'Trường chưa có tên';
}

function problemText(control: Control): string {
  const name = fieldName(control);
  return control.validity.valueMissing ? name : `${name} (giá trị chưa hợp lệ)`;
}

function controlsOf(form: HTMLFormElement): Control[] {
  return Array.from(form.elements).filter(
    (el): el is Control =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && el.willValidate,
  );
}

/**
 * MASTER form pattern for forms that declare their rules with native attributes (required, min, pattern…):
 * the form is noValidate, a Vietnamese summary at the top lists what is missing and takes focus,
 * each failing control gets aria-invalid and points at the summary, and the mark clears once the field is fixed.
 * The validation rules themselves are the attributes already on the fields; nothing new is enforced.
 */
export function useFormCheck(summaryId: string) {
  const [problems, setProblems] = useState<string[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const mark = (control: Control, invalid: boolean) => {
    if (invalid) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', summaryId);
    } else if (control.getAttribute('aria-describedby') === summaryId) {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    }
  };

  /** Wraps the form's own submit handler; it only runs when every field passes. */
  const guard = useCallback(
    <E extends React.FormEvent<HTMLFormElement>>(handler: (event: E) => unknown) =>
      (event: E) => {
        formRef.current = event.currentTarget;
        // validity.valid, not checkValidity(): the latter fires `invalid`, which some pickers answer by opening and grabbing focus.
        const invalid = controlsOf(event.currentTarget).filter(control => {
          const bad = !control.validity.valid;
          mark(control, bad);
          return bad;
        });
        if (invalid.length) {
          event.preventDefault();
          setProblems(invalid.map(problemText));
          requestAnimationFrame(() => summaryRef.current?.focus());
          return;
        }
        setProblems([]);
        return handler(event);
      },
    [summaryId],
  );

  /** Re-checks every marked field; drops the ones that are now valid. Returns the remaining problems. */
  const recheck = useCallback(
    (form: HTMLFormElement) =>
      controlsOf(form)
        .filter(control => control.getAttribute('aria-invalid') === 'true' && control.getAttribute('aria-describedby') === summaryId)
        .filter(control => {
          if (control.validity.valid) mark(control, false);
          return !control.validity.valid;
        })
        .map(problemText),
    [summaryId],
  );

  /** Attach to the form's onChange so typed fields clear as soon as they are fixed. */
  const onFieldChange = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (!problems.length) return;
      setProblems(recheck(event.currentTarget));
    },
    [problems.length, recheck],
  );

  // Pickers (hamlet, household) set a hidden input from code without a change event: re-check after each render.
  useEffect(() => {
    if (!problems.length || !formRef.current) return;
    const next = recheck(formRef.current);
    if (next.join('|') !== problems.join('|')) setProblems(next);
  });

  return { problems, summaryRef, guard, onFieldChange };
}

export function FormCheckSummary({
  id,
  problems,
  summaryRef,
}: {
  id: string;
  problems: string[];
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!problems.length) return null;
  return (
    <div id={id} ref={summaryRef} tabIndex={-1} role="alert" className="gis-form-summary">
      <strong>Còn {problems.length} thông tin cần nhập hoặc sửa:</strong>
      <ul>
        {problems.map((problem, index) => (
          <li key={`${index}-${problem}`}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}
