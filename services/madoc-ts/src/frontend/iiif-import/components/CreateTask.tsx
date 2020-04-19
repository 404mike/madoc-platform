/* eslint-disable @typescript-eslint/camelcase */
import { useFormik } from 'formik';
import React, { useState } from 'react';
import styled, { css } from 'styled-components';

type CreateTaskType = {
  type: string;
  name: string;
  description: string;
  subject: string;
  status: string;
  status_text: string;
};

const Form = styled.form`
  max-width: 500px;
  width: 100%;
  margin: 40px auto;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 5px;
  display: block;
`;

const baseFormStyles = css`
  background: #fff;
  border: 2px solid #ddd;
  font-size: 14px;
  margin-bottom: 20px;
  padding: 5px;
  width: 100%;

  &:focus,
  &:active {
    border-color: #2879ff;
    outline: none;
  }
`;

const Dropdown = styled.select`
  position: relative;
  width: 100%;
  background: transparent;
  margin-bottom: 20px;
  padding: 5px;
  border: 2px solid #ddd;
  height: 30px;
  border-radius: 0;

  &:focus,
  &:active {
    border-color: #2879ff;
    outline: none;
  }
`;

const TextBox = styled.input`
  ${baseFormStyles}
`;

const TextArea = styled.textarea`
  ${baseFormStyles}
  resize: vertical;
  min-height: 40px;
`;

const Button = styled.button`
  padding: 6px 16px;
  background: #2879ff;
  font-size: 16px;
  color: #fff;
  border-radius: 3px;
  border: 2px solid transparent;
  box-sizing: border-box;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }

  &:focus {
    border: 2px solid #1d1890;
    outline: none;
  }
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 10px;
  font-weight: 500;
`;

const HeadingPara = styled.p`
  font-size: 1.2em;
  margin-bottom: 50px;
`;

const Success = styled.div`
  background: #29a745;
  border: 1px solid #217c3b;
  padding: 10px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #fff;
  border-radius: 3px;
`;

export const CreateTask = () => {
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const { values, handleChange, handleSubmit } = useFormik<CreateTaskType>({
    initialValues: {
      type: 'administrative',
      name: '',
      description: '',
      subject: '',
      status: '0',
      status_text: '',
    },
    onSubmit: (newValues, { resetForm }) => {
      setSaving(true);

      fetch('/api/tasks', {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...newValues, status: Number(newValues.status) }),
      }).then(() => {
        resetForm();
        setSuccess(true);
        setSaving(false);
      });
    },
  });

  return (
    <Form onSubmit={handleSubmit} autoComplete="off">
      <Heading>Create a task</Heading>
      <HeadingPara>A human created task for you to complete yourself.</HeadingPara>

      {success && <Success onClick={() => setSuccess(false)}>Task successfully created.</Success>}

      <Label htmlFor="name">Name</Label>
      <TextBox type="text" id="name" name="name" onChange={handleChange} value={values.name} />

      <Label htmlFor="description">Description</Label>
      <TextArea rows={4} id="description" name="description" onChange={handleChange} value={values.description} />

      <Label htmlFor="type">Type</Label>
      <Dropdown onChange={handleChange} value={values.type} id="type" name="type">
        <option value="administrative">Administrative</option>
      </Dropdown>

      <Label htmlFor="subject">Subject</Label>
      <TextBox type="text" id="subject" name="subject" onChange={handleChange} value={values.subject} />

      <Label htmlFor="status_text">Custom status text</Label>
      <TextBox type="text" id="status_text" name="status_text" onChange={handleChange} value={values.status_text} />

      <Label htmlFor="status">Status</Label>
      <Dropdown onChange={handleChange} value={values.status} id="status" name="status">
        <option value="0">Not started</option>
        <option value="1">Accepted</option>
        <option value="2">In progress</option>
        <option value="3">Done</option>
        <option value="-1">Error</option>
      </Dropdown>

      <Button type="submit" disabled={saving}>
        Create
      </Button>
    </Form>
  );
};
