import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const placeholderPosters = [
  { uri: 'https://image.tmdb.org/t/p/w500/7bWxAsNPv9CXHOhZbJVlj2KxgfP.jpg', title: 'The Little Mermaid' },
  { uri: 'https://image.tmdb.org/t/p/w500/8FhKnPpql374qyyHAkZDld93IUw.jpg', title: 'To Catch a Killer' },
  { uri: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', title: 'Spider-Man: Across the Spider-Verse' },
];

const Section = ({ title, showSeeAll }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {showSeeAll && (
      <TouchableOpacity>
        <Text style={styles.seeAll}>See All</Text>
      </TouchableOpacity>
    )}
  </View>
);

const PosterCarousel = ({ data, large }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
    {data.map((item, idx) => (
      <View key={idx} style={[styles.posterContainer, large && styles.largePosterContainer]}>
        <Image source={{ uri: item.uri }} style={[styles.poster, large && styles.largePoster]} />
        <Text style={styles.posterTitle} numberOfLines={1}>{item.title}</Text>
      </View>
    ))}
  </ScrollView>
);

export default function MediaScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          <Text style={styles.headerTitleM}>M</Text>ovies
        </Text>
        <TouchableOpacity>
          <Ionicons name="search" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView>
        {/* Trending Section */}
        <Section title="Trending" />
        <PosterCarousel data={placeholderPosters} large />
        {/* Upcoming Section */}
        <Section title="Upcoming" showSeeAll />
        <PosterCarousel data={placeholderPosters} />
        {/* Top Rated Section */}
        <Section title="Top Rated" showSeeAll />
        <PosterCarousel data={placeholderPosters} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181818',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerTitleM: {
    color: '#FFD700', // gold/yellow
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  seeAll: {
    color: '#FFD700',
    fontWeight: '600',
  },
  posterContainer: {
    width: 110,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  largePosterContainer: {
    width: 180,
  },
  poster: {
    width: 110,
    height: 160,
    borderRadius: 12,
    marginBottom: 6,
  },
  largePoster: {
    width: 180,
    height: 260,
  },
  posterTitle: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    width: '100%',
  },
});
