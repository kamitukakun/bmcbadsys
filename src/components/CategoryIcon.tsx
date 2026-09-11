import React from 'react';
import {
  Users,
  UserCheck,
  Coins,
  Trophy,
  Shirt,
  Award,
  Archive,
  PlusCircle,
  Activity,
  Landmark,
  Zap,
  FileBadge,
  Wrench,
  ShieldCheck,
  Sparkles,
  FileText,
  MinusCircle,
  Banknote,
  QrCode,
  Building,
  MessageCircle,
  CreditCard,
  CircleDollarSign,
  HelpCircle,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-4 h-4' }) => {
  switch (name) {
    case 'Users':
      return <Users className={className} />;
    case 'UserCheck':
      return <UserCheck className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'Trophy':
      return <Trophy className={className} />;
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Archive':
      return <Archive className={className} />;
    case 'PlusCircle':
      return <PlusCircle className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    case 'Landmark':
      return <Landmark className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'FileBadge':
      return <FileBadge className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    case 'MinusCircle':
      return <MinusCircle className={className} />;
    case 'Banknote':
      return <Banknote className={className} />;
    case 'QrCode':
      return <QrCode className={className} />;
    case 'Building':
      return <Building className={className} />;
    case 'MessageCircle':
      return <MessageCircle className={className} />;
    case 'CreditCard':
      return <CreditCard className={className} />;
    case 'CircleDollarSign':
      return <CircleDollarSign className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
};
