import React from 'react';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import AuthPage from './components/Auth/AuthPage';

function App() {
  return (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  );
}

export default App;
