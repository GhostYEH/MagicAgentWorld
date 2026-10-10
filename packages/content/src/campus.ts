/**
 * 校园世界：六章复用的校园地图、公告与资料库。
 */

import type { CampusData, LocationDef } from '@agentcraft/engine';

export const CAMPUS_LOCATIONS: Record<string, LocationDef> = {
  east_gate: {
    id: 'east_gate',
    name: '东门',
    neighbors: { admin: 10 },
    open: [6 * 60, 22 * 60],
  },
  admin: {
    id: 'admin',
    name: '行政楼（身份核验）',
    neighbors: { east_gate: 10, dorm: 15 },
    open: [8 * 60, 18 * 60],
  },
  dorm: {
    id: 'dorm',
    name: '宿舍区（宿舍登记）',
    neighbors: { admin: 15, card_center: 20 },
    open: [8 * 60, 18 * 60],
  },
  card_center: {
    id: 'card_center',
    name: '校园卡中心',
    neighbors: { dorm: 20, library: 8 },
    open: [8 * 60, 18 * 60],
  },
  library: {
    id: 'library',
    name: '图书馆',
    neighbors: { card_center: 8 },
    open: [8 * 60, 21 * 60],
  },
};

export const CAMPUS_DATA: CampusData = {
  announcements: [
    {
      id: 'ann.report',
      title: '新生报到日程',
      body: '8:50 从东门出发，依次完成身份核验、宿舍登记与校园卡领取；参考完成时间 09:50。',
      at: 8 * 60,
      visibleByDefault: true,
    },
    {
      id: 'ann.dorm',
      title: '宿舍登记须知',
      body: '宿舍登记需先完成身份核验，并出示身份凭据。',
      at: 8 * 60,
      visibleByDefault: true,
    },
    {
      id: 'ann.card',
      title: '校园卡领取',
      body: '凭宿舍登记凭据，到校园卡中心领取校园卡。',
      at: 8 * 60,
      visibleByDefault: true,
    },
    {
      id: 'ann.library',
      title: '图书馆资料与预约',
      body: '可在资料库按主题与年份检索，并预约时段 14:00-15:00。',
      at: 8 * 60,
      visibleByDefault: true,
    },
  ],
  documents: [
    {
      id: 'doc.ai2024',
      title: '人工智能发展报告',
      year: 2024,
      topics: ['人工智能'],
      version: 'v2024.3',
      summary: '概述 2024 年人工智能关键技术进展与应用。',
    },
    {
      id: 'doc.agent2024',
      title: '智能体技术白皮书',
      year: 2024,
      topics: ['人工智能', '智能体'],
      version: 'v2024.1',
      summary: '介绍智能体的组成、工具调用与运行控制。',
    },
    {
      id: 'doc.edu2023',
      title: '教育技术年度综述',
      year: 2023,
      topics: ['教育'],
      version: 'v2023.2',
      summary: '回顾 2023 年教育技术发展。',
    },
  ],
  librarySlots: ['14:00-15:00', '15:00-16:00', '16:00-17:00'],
};
